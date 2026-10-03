import gc
import json
import os
from functools import lru_cache

import gradio as gr
import spaces
import torch
from huggingface_hub import hf_hub_download
from transformers import pipeline

HF_TOKEN=os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN Space secret is required.")

ASR_MODELS={
    "english":"NCAIR1/NigerianAccentedEnglish",
    "yoruba":"NCAIR1/Yoruba-ASR",
    "hausa":"NCAIR1/Hausa-ASR",
    "igbo":"NCAIR1/Igbo-ASR",
}

ALIASES={
    "en":"english","en-ng":"english","english":"english","nigerian english":"english",
    "yo":"yoruba","yor":"yoruba","yoruba":"yoruba",
    "ha":"hausa","hau":"hausa","hausa":"hausa",
    "ig":"igbo","ibo":"igbo","igbo":"igbo",
}

_active_asr_pipeline=None
_active_asr_model_id=None

def normalize_language(language:str)->str:
    key=(language or "english").strip().lower()
    if key not in ALIASES:
        raise ValueError(f"Unsupported ASR language: {language}")
    return ALIASES[key]

def verify_model_access():
    results={}
    for language,model_id in ASR_MODELS.items():
        try:
            hf_hub_download(model_id,"config.json",token=HF_TOKEN)
            results[language]={"model":model_id,"accessible":True}
        except Exception as exc:
            results[language]={"model":model_id,"accessible":False,"error":str(exc)}
    return results

def _load_asr(language:str):
    global _active_asr_pipeline,_active_asr_model_id
    language=normalize_language(language)
    model_id=ASR_MODELS[language]

    if _active_asr_pipeline is not None and _active_asr_model_id==model_id:
        return _active_asr_pipeline,model_id

    if _active_asr_pipeline is not None:
        del _active_asr_pipeline
        _active_asr_pipeline=None
        _active_asr_model_id=None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    _active_asr_pipeline=pipeline(
        "automatic-speech-recognition",
        model=model_id,
        token=HF_TOKEN,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device=0 if torch.cuda.is_available() else -1,
    )
    _active_asr_model_id=model_id
    return _active_asr_pipeline,model_id

@spaces.GPU(duration=60)
def transcribe(audio_path:str,language:str)->str:
    if not audio_path:
        raise ValueError("Upload or record audio first.")

    normalized=normalize_language(language)
    asr,model_id=_load_asr(normalized)

    with torch.inference_mode():
        result=asr(audio_path)

    text=str(result.get("text","") if isinstance(result,dict) else result).strip()
    return json.dumps({
        "text":text,
        "model":model_id,
        "language":normalized,
        "provider":"ileraher_zerogpu_asr",
    },ensure_ascii=False)

with gr.Blocks(title="ÌleraHer N-ATLAS Runtime") as demo:
    gr.Markdown("# ÌleraHer N-ATLAS Runtime")
    gr.Markdown("Official NCAIR ASR runtime for Nigerian English, Yorùbá, Hausa and Igbo.")
    audio=gr.Audio(type="filepath",label="Audio")
    language=gr.Dropdown(
        choices=["english","yoruba","hausa","igbo"],
        value="english",
        label="Language",
    )
    run=gr.Button("Transcribe")
    output=gr.Textbox(label="Structured response")
    run.click(transcribe,inputs=[audio,language],outputs=output,api_name="transcribe")

if __name__=="__main__":
    demo.queue().launch()
