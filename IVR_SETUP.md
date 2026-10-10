# Ordinary-phone IVR activation

The application implements an incoming Twilio Programmable Voice journey. Code deployment alone does not activate a telephone service. Keep IVR_ENABLED=false while configuring dependencies, then enable it for controlled acceptance calls before publishing. No number is purchased by the application. For a nonprofit credit-funded pilot, see [IVR credit pilot](docs/IVR_CREDIT_PILOT.md).

## Server configuration

Configure the following securely in the application's hosting environment. Do not place secrets in browser variables, Git, or chat:

- TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN: the account owning the voice-capable number.
- IVR_PHONE_NUMBER: that number in E.164 format.
- IVR_PUBLIC_BASE_URL: the application's exact HTTPS origin, without a path or query.
- IVR_SESSION_SECRET: a cryptographically random secret of at least 32 characters. Rotating it invalidates active calls and encrypted temporary results.
- DATABASE_URL: the app's persistent PostgreSQL connection; IVR uses it by default. IVR_DATABASE_URL optionally selects a separate database. The application creates the IVR jobs, profiles and history tables. The database role needs CREATE TABLE and access to these tables. Use internal networking or a certificate-verified TLS connection.
- N-ATLAS ASR runtime: the existing application transcription provider must be reachable and able to load the required official checkpoints.
- NATLAS_LLM_API_URL / key, or NATLAS_HF_LLM_SPACE: a functioning official N-ATLAS text service. The IVR worker fails safely if non-urgent generation is unavailable; urgent guidance preserves the curated care instructions.

In the Twilio number's Voice configuration, set **A call comes in** to the application's `/api/ivr/incoming` URL, with **HTTP POST**. The readiness endpoint verifies account ownership, voice capability, and this exact webhook mapping before exposing the call button.

## Nigerian-language audio

English uses Twilio's supported en-GB playback; this is not a claim of a Nigerian-accented synthetic voice. The app does not use unverified yo-NG, ha-NG or ig-NG Say locales.

For Yorùbá, Hausa and Igbo, set:

- IVR_PROMPT_BASE_URL: HTTPS directory containing native-speaker-reviewed audio at `<base>/<yo|ha|ig>/<name>.mp3`. Names: consent, record, waiting, menu, error, goodbye. Consent must explain recording/processing, deletion after processing, non-emergency limitations, 1 to agree and 2 to end. The menu must explain 1 replay, 2 another question, 9 change language, 3 end.
- IVR_TTS_API_URL and optional IVR_TTS_API_KEY: a trusted HTTPS speech service. Contract: POST JSON `{ "text": "...", "language": "yo" }` (or ha/ig), optional Bearer authentication. Return audio/mpeg or audio/wav bytes, at most 4 MiB. Health response text is transmitted to this service; include it in the caller consent/privacy explanation.
- IVR_TTS_LANGUAGES: comma-separated yo,ha,ig entries only after the corresponding prompts and speech generation have been tested. Unsupported language choices return to the menu rather than reading them in another language.

Prompt files and TTS are required deployment inputs; the repository does not invent human-reviewed language recordings or an external speech provider.

## Processing and retention

Twilio's recording-completed callback queues an idempotent job and responds immediately. Next.js after() performs inference outside the webhook response. A PostgreSQL lease prevents duplicate workers; caller polling can recover a lease after a process restart. This is an incoming-call-driven job runner, not a separately scheduled background worker. A disconnected caller whose worker was interrupted does not initiate recovery on their own; a separate worker would be needed for processing after the call ends.

Audio retrieval uses a Twilio URL constructed from verified account and recording identifiers; webhook-supplied URLs are never fetched. Caller phone numbers and transcripts are not logged or stored in the job table. Results are encrypted with AES-GCM, and CallSid is stored as a keyed hash. The worker attempts deletion of the provider recording after success or failure. Provider cleanup failure is logged without identifiers; inspect Twilio retention settings independently. No guarantee of deletion is made if the server crashes before cleanup.

Signed call and media links expire after 20 minutes. Expired database rows are purged on subsequent enqueue/read operations; this is not a scheduled retention guarantee during inactivity. For a fixed physical deletion deadline, deploy a cleanup job before public launch. Do not log full webhook URLs: their state token grants temporary access to response audio.

## Activation and real-call verification

1. Verify actual ASR and N-ATLAS text responses, database connectivity, number mapping, prompt audio and TTS. Read-only checks at `/api/ivr/status` run while IVR_ENABLED=false. `providerVerified` confirms credentials; `numberOwned` confirms the configured voice-capable number; `webhookConfigured` confirms its exact POST mapping. `accountType` distinguishes Trial from Full. Trial and suspended accounts are not advertised for public calling.
2. `setupReady=true` requires core configuration, reachable database, loaded ASR/text models, an active Full provider account and verified number mapping. Set IVR_ENABLED=true for controlled acceptance calls; `ready=true` then exposes the number. These checks do not prove carrier reachability, available credit, successful calls or model accuracy. LLM and native-language playback still require real tests.
3. Use consented, non-sensitive test concerns. Verify every language: choose keypad option, decline consent, agree, speak after beep, press #, wait, hear guidance, replay, record another concern, change language and hang up.
4. Test silence, invalid digits, long recordings, inference failure, slow generation, duplicate callbacks, missing device audio, restarted workers and expired media links. Confirm provider recordings are deleted and database rows expire.
5. Check caller charges and Nigerian caller reachability in the provider account before publishing the number. The application does not claim toll-free access.

Reference documentation: https://www.twilio.com/docs/voice/twiml/record ; https://www.twilio.com/docs/usage/webhooks/webhooks-security ; https://www.twilio.com/docs/voice/twiml/say/text-speech
