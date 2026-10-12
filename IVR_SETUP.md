# Ordinary telephone calls

ÌleraHer's ordinary-call transport uses Twilio Programmable Voice. A caller uses a normal telephone network, keypad and microphone. They need neither internet, a smartphone, an app account nor app-based registration. The cloud service needs internet and a real carrier-connected number. This is separate from the internet call at `/call` and the optional hardware SIM gateway.

## Caller journey

Dial the agent's number, then choose **1 English, 2 Yorùbá, 3 Hausa, 4 Igbo**. Consent with key 1, speak after the beep for up to 45 seconds, and press # when finished. N-ATLaS transcribes in the selected language and produces grounded guidance; YarnGPT2b speaks the reply in that same language. Key 1 replays, 2 asks a follow-up, 9 changes language and 3 ends the call. No provider text-to-speech fallback reads health replies. Speech failures play a prerecorded error menu; reviewed urgent-care guidance cannot be downgraded by generation.

Optional saved history uses a six-digit keypad PIN chosen during a call. It is not required to receive guidance. Withheld caller IDs continue as guests. The [full caller/storage documentation](docs/IVR_CALLS.md) describes consent, history and deletion.

## Prepare speech controls

Consent and keypad instructions are recorded once with YarnGPT, so answering a call does not require fresh GPU inference for a menu. Draft scripts for all four languages are in `src/lib/ivr-prompt-scripts.json`. Review the translations and listen to the generated recordings before public use; the presence of scripts is not evidence of native-speaker acceptance.

Using the application's existing verified audio service, run:

```sh
node scripts/prepare-ivr-prompts.mjs
```

The script checks the verified application audio route's model/language/WAV headers and writes public menu WAVs plus a checksum/script manifest under `public/audio/ivr`. It resumes completed files after a quota interruption and reports the service's actual retry time when supplied. `--only=yo/consent` prepares one recording; `--languages=en-NG` prepares an English pilot. `--app-url=` selects the deployed HTTPS origin. For direct runtime access, use `--direct-runtime` with the existing Hugging Face token supplied securely in the environment; this mode verifies the runtime's exact provider/model/language and downloads only from the fixed Space. Native-language history requires additional reviewed history scripts and remains disabled by default.

Deploy the prepared public assets with the application, or host that directory at a trusted HTTPS origin. Set `IVR_PROMPT_BASE_URL` to the directory containing `manifest.json`, for example `https://ilera-her-ai.onrender.com/audio/ivr/`. The readiness check verifies the required scripts, model declaration and actual WAV checksums. No generated menu recordings are bundled until preparation succeeds. Generic English setup errors can use the provider's unavailable notice before the pack is installed; active-call menus and health replies play model audio.

## Connect the telephone provider

Configure server variables securely, following `.env.example`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: the account owning the voice number.
- `IVR_PHONE_NUMBER`: that owned, voice-capable E164 number; a personal verified caller ID is insufficient.
- `IVR_PUBLIC_BASE_URL=https://ilera-her-ai.onrender.com`.
- `IVR_SESSION_SECRET`: stable random 32+ character key for signed 20-minute call state and encrypted temporary responses.
- `DATABASE_URL`: existing PostgreSQL database; optional `IVR_DATABASE_URL` overrides it.
- Existing gated-model Hugging Face access and loaded N-ATLaS ASR/text and YarnGPT2b models.
- `IVR_PROMPT_BASE_URL` and `IVR_LANGUAGES=en-NG,yo,ha,ig`, covering every enabled language's verified control recordings.
- Optional separate `IVR_PROFILE_SECRET`, reviewed native `IVR_HISTORY_PROMPT_LANGUAGES`, and `IVR_MAINTENANCE_SECRET` for saved history/retention.

Set the owned number's voice webhook to **POST https://ilera-her-ai.onrender.com/api/ivr/incoming**, or run `node scripts/configure-ivr-number.mjs` with credentials supplied by the trusted environment. The script configures an existing owned number; it never purchases one, upgrades the account or adds funds.

Keep `IVR_ENABLED=false` during preparation. `/api/ivr/status` diagnoses the database, loaded ASR/LLM/TTS, exact webhook, account restrictions and playable prompt pack independently. `setupReady=true` requires an active Full account and all dependencies. Trial callers are restricted by the provider and a Trial account is not published as a public service.

Set `IVR_ENABLED=true` for arranged acceptance calls while keeping `IVR_PHONE_VERIFIED=false`. After actual basic-phone calls pass in every enabled language, set `IVR_PHONE_VERIFIED=true`. Only then does `ready=true` allow the interface to display the agent number and ordinary-call button. This operator attestation does not verify remaining carrier credit or replace recurring service monitoring.

An existing Nigerian SIM is not connected by putting its number in an environment variable. Keeping that public number without a hardware gateway requires carrier-side forwarding, porting or a compatible hosted carrier connection, and verification of its charges and reachability. Confirm Nigerian number inventory and caller costs in the provider account; do not silently substitute an international number for a local access goal. Normal airtime charges can apply even though the caller needs no mobile data.

For a possible credit-funded nonprofit pilot see [IVR_CREDIT_PILOT.md](docs/IVR_CREDIT_PILOT.md). Approval is not established and credits are finite. No paid purchase, recharge, upgrade or carrier forwarding has been authorised.

## Verify a real call

Use consented, non-sensitive test concerns. With mobile data and Wi-Fi off, call from a basic telephone, choose each enabled language and test consent decline, recording, audible response, replay, follow-up, language change and hang-up. Verify urgent instructions across follow-ups, silence/invalid digits, speech quota failure, provider recording deletion and expired media. Also test PIN lockout/deletion if history is enabled. Code tests and `ready` cannot prove a carrier call occurred.

The existing free hosting/ZeroGPU setup can sleep or exhaust compute quota. A public hotline needs reliable capacity and an agreed operating budget; the implementation has not upgraded those resources. Signed webhook endpoints respond quickly, while durable jobs run outside the response and callers poll briefly for up to four minutes. A job lease is long enough for transcription, generation and synthesis. Caller recordings are deleted after processing attempts; no raw audio, PIN or transcript is logged.

Official provider documentation: [recording](https://www.twilio.com/docs/voice/twiml/record), [audio playback](https://www.twilio.com/docs/voice/twiml/play), [webhook signatures](https://www.twilio.com/docs/usage/webhooks/webhooks-security).
