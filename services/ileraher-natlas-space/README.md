---
title: IleraHer N-ATLAS Runtime
emoji: 🎙️
colorFrom: pink
colorTo: purple
sdk: gradio
sdk_version: 5.49.1
python_version: "3.10"
suggested_hardware: zero-a10g
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

All four FP16 pipelines are initialized and placed on CUDA at startup, as required by ZeroGPU. Requests are serialized, with no model switching or unloading. Startup memory and actual inference must be checked on the authorized hardware; this code is not evidence of a working deployment.

Add `HF_TOKEN` as a Hugging Face Space secret. The token must have gated access to all four official NCAIR repositories.

The caller must verify the returned `model` matches the expected model for the requested language.


## Hosting gate and privacy

Configure the **existing** `Erioluwa24/ileraher-natlas-runtime` only after its
settings confirm free ZeroGPU eligibility. A free account requires a verified
email and account age over 30 days, and may host at most two ZeroGPU Spaces.
`suggested_hardware` is a UI suggestion, not a hardware allocation or entitlement.
Never use metadata to bypass the gate. Do not add secrets while SDK is Static.
Select Gradio and actual ZeroGPU hardware through the account's supported settings.
Do not enable paid hardware or credits. CPU Basic compute creation can still require PRO.

Add a read-only, gated-model-authorized `HF_TOKEN` **Space secret** securely.
Render separately needs a read credential through an environment variable or
`/etc/secrets/HF_TOKEN`; this authenticates the JS client to the owned Space.
Keep provisioning credentials separate. Never put tokens in repo files or UI code.

`/status` reports successfully loaded checkpoint revisions and gated-file access;
it does not assert speech accuracy. `/transcribe` accepts audio of up to 25 MB and
60 seconds. FFmpeg decoding is bounded, GPU requests are queued serially, and
uploaded cache files are removed after processing, with Gradio periodic cleanup
for abandoned sessions. Audio and transcripts are not written to application logs.

Before claiming success, run consented/licensed speech through Render's production
`/api/transcribe` in all four languages and record exact transcripts, model IDs,
latency and expected words. Silence or mocked fixtures are not accuracy evidence.

Official hosting guidance:
https://huggingface.co/docs/hub/spaces-overview
https://huggingface.co/docs/hub/spaces-zerogpu
