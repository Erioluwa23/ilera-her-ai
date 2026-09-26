# Render deployment

The repository contains a Render Blueprint in `render.yaml`.

## Service
- Runtime: Node.js 22
- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Auto deploy: enabled

## Secrets
Set `NATLAS_API_URL` and `NATLAS_API_KEY` in Render's environment settings. Never commit their values.

The application can deploy without N-ATLAS credentials, but `/api/transcribe` intentionally returns HTTP 503 until they are configured.
