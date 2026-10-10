# Render deployment

Deploy to the existing `ilera-her-ai` service from `Erioluwa23/ilera-her-ai`, branch `main`. The recorded service ID is `srv-dart3h8u01pc73dpngdg`; its current configuration and live revision must be checked at deployment time. The public URL is `https://ilera-her-ai.onrender.com`.

The repository contains a Render Blueprint in `render.yaml`: Node.js 22, `npm ci && npm run build`, `npm start`, health check `/api/health`, free plan and auto deployment. Do not create a second service or enable paid resources to release this change.

## Release checks

1. Check that remote `main` has not advanced since the release's base revision. The 2026-10-10 implementation is based on `16e4f6268ec21c1327e1f98edeab2ae7ab61056b`. Preserve unrelated remote work if it has advanced.
2. Use the committed release with passing unit/contract tests, browser checks, build and lint; see [implementation handoff](IMPLEMENTATION_HANDOFF.md) and `artifacts/verification.json`. CI also runs six Python runtime boundary tests.
3. Push the release to `main` with an authorized GitHub identity. The current local release is on `work`; use a normal fast-forward push, never force push.
4. Monitor CI and the existing Render service. Check whether auto deployment starts before requesting a manual deployment. Record the exact live commit and deployment ID; a successful push alone does not establish deployment.
5. Check `/api/health`, public Help, login and unauthenticated protected-page redirects. Confirm the new Home/Track/History flows using a synthetic authenticated account. Separately verify configured providers; HTTP 200 from health does not establish successful ASR, AI generation, TTS or phone calls.

## Existing server configuration

Keep the existing `AUTH_SECRET` and database connection stable. Authentication requires a server-only random `AUTH_SECRET` of at least 32 characters; never use the public browser-test fixture secret. `DATABASE_URL` configures the account database and is also the default IVR database. Set credential values only in secure server settings, never in the repository or chat.

ASR retains the fixed owned Hugging Face runtime `Kolade1/ileraHer-natlas-runtime`; `HF_TOKEN` must have the required gated-model access. Separate Space secrets and runtime readiness must be verified independently. Legacy `NATLAS_API_URL`/`NATLAS_API_KEY` do not configure this fixed ASR path.

The default optional explanation order is Groq → OpenAI → basic guidance. `GROQ_API_KEY` and `OPENAI_API_KEY` are server-only; absent keys leave basic guidance available. Model names and time budgets are in `.env.example`. `AI_PROVIDER_MODE=natlas` selects the preserved N-ATLAS demonstration path. Do not claim live provider validation from mocked tests.

Keep `IVR_EXTERNAL_AI_ENABLED=false` until the separate phone processing/consent review is complete. Existing telephony configuration does not establish a working call service.

## Publication boundary

All new clinical policies and care-content entries remain draft. This release exposes record journeys, education and descriptive arithmetic; personal forecasts, new clinical advice and WHO growth percentiles remain withheld. A deployment must not change reviewer metadata or bypass these source-controlled gates. Full WHO integration, localization, native-language review and the human pilot remain pending.

## 2026-10-10 deployment attempt

The user explicitly requested deployment after the local implementation. Remote `main` was verified at the base revision. A push dry run failed with HTTP 403: GitHub reported that connected account `Atanseiye` lacks permission to `Erioluwa23/ilera-her-ai`. No push or Render deployment was performed. Reconnect an identity with write access before retrying the release; credentials must not be pasted into chat.
