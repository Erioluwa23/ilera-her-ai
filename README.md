# ÌleraHer AI

Voice-first menstrual health companion designed for Nigerian women and girls. The current implementation adds account-scoped records and gated maternal/child record keeping.

Implementation status, checks and remaining release dependencies: [handoff](docs/IMPLEMENTATION_HANDOFF.md).

## Product principles

- Private by default and data-minimizing
- Voice-first and low-bandwidth friendly
- Nigerian English, Yoruba, Hausa and Igbo interface choices; native review pending
- Educational and triage-oriented, never diagnostic
- N-ATLAS integration isolated behind a provider boundary

## Safety

ÌleraHer provides menstrual-health education and pattern awareness. It is not a medical device and does not diagnose disease. Clinical deployment requires qualified medical, privacy/security and regulatory review.

## Development

```bash
npm install
npm run dev
```

Use `.env.example` for server-only auth, database, ASR and optional Groq/OpenAI configuration. External AI and conversation/audio retention are explicit settings. Missing model credentials preserve basic guidance. New clinical policies remain draft and unpublished.

## ASR runtime and verification

ASR uses the existing owned `Erioluwa24/ileraher-natlas-runtime` Space.
Render never loads ASR model weights. See `services/ileraher-natlas-space/README.md`
for hosting eligibility, server secrets, and the exact model registry.
`POST /api/transcribe` accepts `audio`; `POST /v1/audio/transcriptions` also accepts
`file`. Both accept the documented language aliases, reject unsupported values,
and enforce a 25 MB payload limit. The runtime supports recordings up to 60 seconds.
The successful response includes text, canonical language, validated model, provider,
Space and latency_ms. Errors include stable code and error fields.

`/api/health` keeps application availability separate from ASR readiness.
`/api/natlas/access` probes authenticated gated config files; it does not run inference.
`ILERAHER_PROGRESS_CHECKPOINT.md` records deployment and real-test evidence and blockers.

Use `npm ci`, `npm test`, `npm run lint`, and `npm run build` for local verification. See the handoff for reproducible synthetic browser checks and live checks still required.

Dedicated phone support setup and acceptance checks: [IVR calls](docs/IVR_CALLS.md).
