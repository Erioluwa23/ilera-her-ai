---
title: IleraHer N-ATLAS Runtime
emoji: 🎙️
colorFrom: pink
colorTo: purple
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
---

# ÌleraHer N-ATLAS Runtime

This Hugging Face Space is the GPU runtime for ÌleraHer's voice-first ASR.

It exposes one Gradio API endpoint:

- `/transcribe(audio, language)`

Supported language values:
- `english` → `NCAIR1/NigerianAccentedEnglish`
- `yoruba` → `NCAIR1/Yoruba-ASR`
- `hausa` → `NCAIR1/Hausa-ASR`
- `igbo` → `NCAIR1/Igbo-ASR`

Only one ASR pipeline is kept on the GPU at a time. The runtime unloads the previous model when the requested language changes.

Add `HF_TOKEN` as a Hugging Face Space secret. The token must have gated access to all four official NCAIR repositories.

The caller must verify the returned `model` matches the expected model for the requested language.
