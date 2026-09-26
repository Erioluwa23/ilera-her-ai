# N-ATLAS inference service

This service is the direct N-ATLAS runtime used by ÌleraHer when deployed on GPU infrastructure.

## Official models
- NCAIR1/N-ATLaS
- NCAIR1/NigerianAccentedEnglish
- NCAIR1/Yoruba-ASR
- NCAIR1/Hausa-ASR
- NCAIR1/Igbo-ASR

All five repositories are gated. The deployment account must accept their terms and provide a Hugging Face token through the standard `HF_TOKEN` environment variable.

## Endpoints
- `GET /health`
- `POST /v1/asr` multipart: `audio`, `language`, `model`
- `POST /v1/chat/completions` OpenAI-compatible chat request

## Deployment
Use a GPU host with enough VRAM for the 8B language model. Do not deploy the 8B model on the current Render free web service. Point the main application's:
- `NATLAS_ASR_API_URL` to `https://<gpu-host>/v1/asr`
- `NATLAS_LLM_API_URL` to `https://<gpu-host>/v1/chat/completions`

The ASR models are loaded lazily per language.

## Attribution
Public use must preserve the attribution required by the N-ATLAS model terms. Review the current model licenses before production or commercial deployment.
