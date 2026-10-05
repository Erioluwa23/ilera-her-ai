"""Owned ZeroGPU ASR, grounded N-ATLaS generation, and YarnGPT2b audio."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading

import spaces  # Must precede torch for ZeroGPU startup CUDA placement.
import gradio as gr
import numpy as np
import torch
from huggingface_hub import hf_hub_download
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    raise RuntimeError("Server-side HF_TOKEN Space secret is required.")

ASR_MODELS = {
    "english": "NCAIR1/NigerianAccentedEnglish",
    "yoruba": "NCAIR1/Yoruba-ASR",
    "hausa": "NCAIR1/Hausa-ASR",
    "igbo": "NCAIR1/Igbo-ASR",
}
ALIASES = {
    "en": "english", "en-ng": "english", "english": "english", "nigerian english": "english",
    "yo": "yoruba", "yor": "yoruba", "yoruba": "yoruba",
    "ha": "hausa", "hau": "hausa", "hausa": "hausa",
    "ig": "igbo", "ibo": "igbo", "igbo": "igbo",
}
LOCK = threading.Lock()
PIPELINES = {}
REVISIONS = {}

# Probe actual gated files before downloading weights. ZeroGPU requires model
# construction and CUDA placement at module startup, outside @spaces.GPU.
# Preload all four FP16 pipelines; no request mutates or unloads a pipeline.
for language, model_id in ASR_MODELS.items():
    try:
        config_path = hf_hub_download(model_id, "config.json", token=HF_TOKEN)
        revision = Path(config_path).parent.name
        REVISIONS[language] = revision
        PIPELINES[language] = pipeline(
            "automatic-speech-recognition", model=model_id, revision=revision,
            token=HF_TOKEN, torch_dtype=torch.float16, device=0,
            model_kwargs={"low_cpu_mem_usage": True},
        )
    except Exception:
        raise RuntimeError(f"Cannot access or load official ASR checkpoint for {language}.") from None


def normalize_language(language):
    key = str(language or "").strip().lower()
    if key not in ALIASES:
        raise ValueError("Unsupported ASR language.")
    return ALIASES[key]


def suspicious_repetition(text):
    from collections import Counter
    words = text.casefold().split()
    if len(words) < 24:
        return False
    counts = Counter(tuple(words[i:i + 4]) for i in range(len(words) - 3))
    return max(counts.values(), default=0) >= 5 and len(counts) / (len(words) - 3) < 0.35


def cleanup_audio(path):
    # Gradio uploads are beneath its temporary cache, never arbitrary files.
    if path:
        resolved = Path(path).resolve()
        cache = Path(os.environ.get("GRADIO_TEMP_DIR", str(Path(tempfile.gettempdir()) / "gradio"))).resolve()
        if cache in resolved.parents:
            resolved.unlink(missing_ok=True)


@spaces.GPU(duration=60)
def infer(samples, language):
    with torch.inference_mode():
        return PIPELINES[language]({"raw": samples, "sampling_rate": 16000}, return_timestamps=True)


def transcribe(audio_path, language):
    try:
        normalized = normalize_language(language)
        if not audio_path or not Path(audio_path).is_file():
            raise gr.Error("A non-empty audio upload is required.")
        if not 0 < Path(audio_path).stat().st_size <= 25 * 1024 * 1024:
            raise gr.Error("Audio must be non-empty and at most 25 MB.")
        # Decode before GPU acquisition. Cap duration and output memory even for
        # highly compressed inputs. The extra second detects overlong speech.
        decoded = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-i", audio_path, "-t", "61",
             "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15, check=True,
        ).stdout
        samples = np.frombuffer(decoded, dtype=np.float32).copy()
        if not 0 < len(samples) <= 60 * 16000 or not np.isfinite(samples).all():
            raise gr.Error("Upload valid audio lasting at most 60 seconds.")
        with LOCK:
            result = infer(samples, normalized)
        text = result.get("text", "").strip()
        if suspicious_repetition(text):
            raise gr.Error("The recording produced repetitive speech text. Please record again in a quieter place.")
        if not text:
            raise gr.Error("No usable transcription was returned.")
        return json.dumps({
            "text": text, "model": ASR_MODELS[normalized], "language": normalized,
            "provider": "ileraher_zerogpu_asr", "revision": REVISIONS[normalized],
        }, ensure_ascii=False)
    except gr.Error:
        raise
    except Exception as exc:
        # Inspect internally, never reproduce upstream exceptions or user data.
        category = str(exc).lower()
        if "quota" in category or "429" in category:
            raise gr.Error("ASR quota exhausted. Try later.") from None
        if "403" in category or "401" in category or "gated" in category:
            raise gr.Error("ASR model access unauthorized.") from None
        raise gr.Error("Official ASR inference could not complete.") from None
    finally:
        cleanup_audio(audio_path)



# Initialize optional models separately: ASR remains available if access is missing.
LLM_ID = "NCAIR1/N-ATLaS"
TTS_ID = "saheedniyi/YarnGPT2b"
LLM = LLM_TOKENIZER = TTS = AUDIO_TOKENIZER = None
GENERATION_STATUS = {"llmLoaded": False, "ttsLoaded": False}
try:
    llm_config = hf_hub_download(LLM_ID, "config.json", token=HF_TOKEN)
    llm_revision = Path(llm_config).parent.name
    LLM_TOKENIZER = AutoTokenizer.from_pretrained(LLM_ID, revision=llm_revision, token=HF_TOKEN)
    LLM = AutoModelForCausalLM.from_pretrained(
        LLM_ID, revision=llm_revision, token=HF_TOKEN,
        torch_dtype=torch.float16, low_cpu_mem_usage=True,
    ).to("cuda").eval()
    GENERATION_STATUS.update(llmLoaded=True, llmModel=LLM_ID, llmRevision=llm_revision)
except Exception as error:
    GENERATION_STATUS["llmFailure"] = type(error).__name__
    GENERATION_STATUS["llmError"] = "N-ATLaS unavailable. HF_TOKEN needs approved access to NCAIR1/N-ATLaS."
try:
    GENERATION_STATUS["ttsStage"] = "dependencies"
    import hashlib
    import gdown
    from yarngpt.audiotokenizer import AudioTokenizerV2
    GENERATION_STATUS["ttsStage"] = "decoder-download"
    config = hf_hub_download(
        "novateur/WavTokenizer-medium-speech-75token",
        "wavtokenizer_mediumdata_frame75_3s_nq1_code4096_dim512_kmeans200_attn.yaml",
        revision="8858552e69270816d6aeb37bfcf3b770769d4899",
    )
    decoder = Path(os.environ.get("HF_HOME", "/tmp/ileraher-models")) / "wavtokenizer_large_speech_320_24k.ckpt"
    decoder.parent.mkdir(parents=True, exist_ok=True)
    if not decoder.exists():
        gdown.download(id="1-ASeEkrn4HY49yZWHTASgfGFNXdVnLTt", output=str(decoder), quiet=True)
    digest = hashlib.sha256()
    with decoder.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != "7450020c154f6aba033cb8651466cb79cb1b1cdd10ea64eaba68e7871cabcc5a":
        decoder.unlink(missing_ok=True)
        raise ValueError("Decoder integrity check failed")
    GENERATION_STATUS["ttsStage"] = "model-load"
    tts_config = hf_hub_download(TTS_ID, "config.json")
    tts_revision = Path(tts_config).parent.name
    TTS = AutoModelForCausalLM.from_pretrained(
        TTS_ID, revision=tts_revision, torch_dtype=torch.float16, low_cpu_mem_usage=True,
    ).to("cuda").eval()
    GENERATION_STATUS["ttsStage"] = "decoder-load"
    AUDIO_TOKENIZER = AudioTokenizerV2(TTS_ID, str(decoder), config)
    AUDIO_TOKENIZER.device = torch.device("cuda")
    AUDIO_TOKENIZER.wavtokenizer = AUDIO_TOKENIZER.wavtokenizer.to("cuda").eval()
    GENERATION_STATUS.update(ttsLoaded=True, ttsStage="ready", ttsModel=TTS_ID, ttsRevision=tts_revision)
except Exception as error:
    GENERATION_STATUS["ttsFailure"] = type(error).__name__
    GENERATION_STATUS["ttsError"] = "YarnGPT2b or its verified WavTokenizer decoder could not load."


@spaces.GPU(duration=60)
def generate_answer(prompt):
    with torch.inference_mode():
        inputs = LLM_TOKENIZER.apply_chat_template(prompt, add_generation_prompt=True, return_tensors="pt").to("cuda")
        if inputs.shape[-1] > 6000:
            raise ValueError("Question context is too long")
        output = LLM.generate(inputs, max_new_tokens=350, do_sample=False,
                              repetition_penalty=1.08, pad_token_id=LLM_TOKENIZER.eos_token_id)
        return LLM_TOKENIZER.decode(output[0, inputs.shape[-1]:], skip_special_tokens=True).strip()


def answer(question, context, language, system):
    normalized = normalize_language(language)
    if not GENERATION_STATUS["llmLoaded"]:
        raise gr.Error(GENERATION_STATUS["llmError"])
    if not isinstance(question, str) or not 3 <= len(question) <= 1200 or len(context) > 24000 or len(system) > 4000:
        raise gr.Error("Invalid question or context.")
    json.loads(context)
    messages = [{"role": "system", "content": system + " Reply in " + normalized + "."},
                {"role": "user", "content": "GROUNDED_CONTEXT:\n" + context + "\nUSER_QUESTION:\n" + question}]
    with LOCK:
        text = generate_answer(messages)
    if not text:
        raise gr.Error("N-ATLaS returned no answer.")
    return json.dumps({"text": text, "model": LLM_ID, "provider": "ileraher_zerogpu_llm", "language": normalized})


@spaces.GPU(duration=60)
def generate_audio(text, language):
    speakers = {"english": "idera", "yoruba": "yoruba_female2", "hausa": "hausa_female2", "igbo": "igbo_female2"}
    with torch.inference_mode():
        # Sentence chunks avoid YarnGPT's context limit and speech truncation.
        import re
        chunks = re.findall(r"[^.!?]+[.!?]?", text)
        segments = []
        for chunk in chunks:
            words = chunk.split()
            for start in range(0, len(words), 35):
                prompt = AUDIO_TOKENIZER.create_prompt(" ".join(words[start:start + 35]), lang=language, speaker_name=speakers[language])
                inputs = AUDIO_TOKENIZER.tokenize_prompt(prompt)
                output = TTS.generate(inputs, max_new_tokens=2500, do_sample=True, temperature=0.1, repetition_penalty=1.1)
                codes = AUDIO_TOKENIZER.get_codes(output)
                if not codes or any(code < 0 or code >= 4096 for code in codes):
                    raise ValueError("Invalid audio codes")
                segments.append(AUDIO_TOKENIZER.get_audio(codes).reshape(-1).float())
        audio = torch.cat(segments).numpy()
        if not np.isfinite(audio).all() or len(audio) > 80 * 24000:
            raise ValueError("Invalid or overlong audio")
        return (24000, audio)


def synthesize(text, language):
    normalized = normalize_language(language)
    if not GENERATION_STATUS["ttsLoaded"]:
        raise gr.Error(GENERATION_STATUS["ttsError"])
    if not isinstance(text, str) or not text.strip() or len(text) > 6000 or len(text.split()) > 180:
        raise gr.Error("Reply is too long for audio. Please ask for a shorter answer.")
    with LOCK:
        audio = generate_audio(text.strip(), normalized)
    return audio, json.dumps({"model": TTS_ID, "language": normalized, "provider": "ileraher_zerogpu_tts"})


def runtime_status():
    return json.dumps({"provider": "ileraher_zerogpu_asr", "gatedModelsAccessible": True,
            "modelsLoaded": len(PIPELINES) == 4, "revisions": REVISIONS,
            "inferenceTested": False, **GENERATION_STATUS})


with gr.Blocks(title="ÌleraHer NCAIR ASR", analytics_enabled=False, delete_cache=(60, 300)) as demo:
    gr.Markdown("# ÌleraHer official NCAIR ASR\nAudio is processed temporarily. Upload at most 60 seconds.")
    audio = gr.Audio(type="filepath", format=None, label="Audio")
    language = gr.Dropdown(list(ASR_MODELS), value="english", label="Language")
    output = gr.Textbox(label="Structured response")
    gr.Button("Transcribe").click(transcribe, [audio, language], output,
                                  api_name="transcribe", concurrency_limit=1, concurrency_id="asr")
    question = gr.Textbox(label="Question")
    context = gr.Textbox(label="Reviewed context JSON")
    system = gr.Textbox(label="Answer instructions")
    gr.Button("Answer").click(answer, [question, context, language, system], gr.Textbox(), api_name="answer", concurrency_limit=1, concurrency_id="asr")
    reply = gr.Textbox(label="Reply to read aloud")
    gr.Button("Speak").click(synthesize, [reply, language], [gr.Audio(label="Spoken reply"), gr.Textbox(label="Audio provenance")], api_name="synthesize", concurrency_limit=1, concurrency_id="asr")
    gr.Button("Runtime status").click(runtime_status, outputs=gr.Textbox(), api_name="status", queue=False)

if __name__ == "__main__":
    demo.queue(max_size=8, default_concurrency_limit=1).launch(
        server_name="0.0.0.0", server_port=7860, max_file_size="25mb", show_error=False,
    )
