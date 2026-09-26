# N-ATLAS challenge architecture

## Channels

### 1. Low-bandwidth mobile
`/lite` is a minimal PWA interface with a cache-first shell. It uses the same `/api/ask` backend as the full product.

### 2. Browser voice
The user chooses Nigerian English, Yoruba, Hausa or Igbo. `/api/transcribe` routes the recording to the corresponding official N-ATLAS ASR model.

### 3. IVR
A telephony provider sends inbound calls to `/api/ivr/incoming`. The caller chooses a language, records a question, the recording is transcribed with N-ATLAS ASR, and the grounded answer is generated with N-ATLAS LLM before being returned through the phone channel.

### 4. Multilingual LLM
`/api/ask` provides medically grounded context to NCAIR1/N-ATLaS and requests a response in the selected Nigerian language. The LLM cannot replace the curated safety/urgency layer.

## Official model mapping
- Nigerian English -> NCAIR1/NigerianAccentedEnglish
- Yoruba -> NCAIR1/Yoruba-ASR
- Hausa -> NCAIR1/Hausa-ASR
- Igbo -> NCAIR1/Igbo-ASR
- Text generation -> NCAIR1/N-ATLaS

## Deployment split
The Next.js product runs on Render. The N-ATLAS 8B model and ASR inference service should run on GPU infrastructure, then be connected to Render through private environment variables.
