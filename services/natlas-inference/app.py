import os
import tempfile
from functools import lru_cache
from typing import Optional

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from huggingface_hub import hf_hub_download
from pydantic import BaseModel
from transformers import (
    AutoModelForCausalLM,
    AutoModelForSpeechSeq2Seq,
    AutoProcessor,
    AutoTokenizer,
    pipeline,
)

app = FastAPI(title="ÌleraHer N-ATLAS Inference", version="0.2.0")

LLM_MODEL = os.getenv("NATLAS_LLM_MODEL", "NCAIR1/N-ATLaS")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HUGGINGFACE_TOKEN")
ASR_MODELS = {
    "en-NG": "NCAIR1/NigerianAccentedEnglish",
    "yo": "NCAIR1/Yoruba-ASR",
    "ha": "NCAIR1/Hausa-ASR",
    "ig": "NCAIR1/Igbo-ASR",
}

def device_name() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"

def require_hf_token() -> str:
    if not HF_TOKEN:
        raise RuntimeError("Hugging Face token is not configured")
    return HF_TOKEN

@lru_cache(maxsize=1)
def get_llm():
    token = require_hf_token()
    tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL, token=token)
    model = AutoModelForCausalLM.from_pretrained(
        LLM_MODEL,
        token=token,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
        low_cpu_mem_usage=True,
    )
    return tokenizer, model

@lru_cache(maxsize=4)
def get_asr(language: str):
    token = require_hf_token()
    model_id = ASR_MODELS[language]
    processor = AutoProcessor.from_pretrained(model_id, token=token)
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id,
        token=token,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        low_cpu_mem_usage=True,
    )
    if torch.cuda.is_available():
        model.to("cuda")
    return pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        device=0 if torch.cuda.is_available() else -1,
    )

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: list[ChatMessage]
    temperature: float = 0.1
    max_tokens: int = 700

@app.get("/health")
def health():
    return {
        "ok": True,
        "device": device_name(),
        "hf_token_configured": bool(HF_TOKEN),
        "llm": LLM_MODEL,
        "asr": ASR_MODELS,
    }

@app.get("/access")
def access():
    token = require_hf_token()
    models = [LLM_MODEL, *ASR_MODELS.values()]
    results = {}
    for model_id in models:
        try:
            hf_hub_download(repo_id=model_id, filename="config.json", token=token)
            results[model_id] = {"accessible": True}
        except Exception as exc:
            results[model_id] = {"accessible": False, "error": str(exc)[:220]}
    return {"ok": all(v["accessible"] for v in results.values()), "models": results}

@app.post("/v1/asr")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("en-NG"),
    model: Optional[str] = Form(None),
):
    if language not in ASR_MODELS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    suffix = os.path.splitext(audio.filename or "speech.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await audio.read())
        path = f.name
    try:
        result = get_asr(language)(path)
        return {"text": result["text"], "language": language, "model": ASR_MODELS[language]}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    tokenizer, model = get_llm()
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=min(req.max_tokens, 900),
            do_sample=req.temperature > 0,
            temperature=max(req.temperature, 0.01),
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = outputs[0][inputs["input_ids"].shape[-1]:]
    text = tokenizer.decode(generated, skip_special_tokens=True).strip()
    return {
        "id": "natlas-ileraher",
        "object": "chat.completion",
        "model": LLM_MODEL,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
    }
