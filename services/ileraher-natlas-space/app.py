"""ÌleraHer-owned ZeroGPU ASR. No text-generation or third-party fallback."""
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
from transformers import pipeline

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
        return PIPELINES[language]({"raw": samples, "sampling_rate": 16000})


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


def runtime_status():
    return {"provider": "ileraher_zerogpu_asr", "gatedModelsAccessible": True,
            "modelsLoaded": len(PIPELINES) == 4, "revisions": REVISIONS,
            "inferenceTested": False}


with gr.Blocks(title="ÌleraHer NCAIR ASR", analytics_enabled=False, delete_cache=(60, 300)) as demo:
    gr.Markdown("# ÌleraHer official NCAIR ASR\nAudio is processed temporarily. Upload at most 60 seconds.")
    audio = gr.Audio(type="filepath", format=None, label="Audio")
    language = gr.Dropdown(list(ASR_MODELS), value="english", label="Language")
    output = gr.Textbox(label="Structured response")
    gr.Button("Transcribe").click(transcribe, [audio, language], output,
                                  api_name="transcribe", concurrency_limit=1, concurrency_id="asr")
    gr.Button("Runtime status").click(runtime_status, outputs=gr.JSON(), api_name="status", queue=False)

if __name__ == "__main__":
    demo.queue(max_size=8, default_concurrency_limit=1).launch(
        server_name="0.0.0.0", server_port=7860, max_file_size="25mb", show_error=False,
    )
