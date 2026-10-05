# Dedicated-number voice support

## Implemented flow

An owned voice-capable Twilio number answers incoming calls through signed POST webhooks at `/api/ivr/incoming`. No app, mobile data or typed health questions are needed. The caller chooses English, Yorùbá, Hausa or Igbo on the keypad, consents to recording, speaks after the beep, and receives spoken guidance. Replay is key 1, follow-up is key 2, language change is key 9, end is key 3. Speech recognition uses the selected language on the existing N-ATLaS runtime. Grounded answer generation uses the official N-ATLaS text model; reviewed guidance remains available if generation fails. English playback uses Twilio speech; other languages require the tested HTTPS TTS adapter and reviewed audio prompts.

After recording consent, eligible callers can opt into saved history (key 1) or continue without it (key 2). A valid E164 caller number identifies a profile but never grants access by itself. New callers choose a six digit keypad PIN; returning callers enter it. Five incorrect attempts lock the profile for 15 minutes across calls. Withheld caller numbers and languages without reviewed history prompts continue as guests. Each call asks for the language again.

The last four saved question/answer pairs, with dates, are provided as historical self-reports to grounded generation. They are not diagnoses or proof of current symptoms. A bounded chain of the last four reported questions also supports follow-ups for guests within the same call. Current and immediately preceding reported symptoms determine urgency; urgent guidance includes reviewed care instructions and bypasses generation. Audio from old calls is not retained in the long-term profile.

After an answer, authenticated callers can press 5 then 1 to permanently delete saved history and their PIN. Deletion also removes temporary personalised answers, and ends the call. A future call can start a new profile. There is deliberately no caller-ID-only PIN reset; a lost PIN cannot expose an existing profile. A shared phone and shared PIN share one profile: use guest mode where that is inappropriate.

## Activation requirements

Deployment alone does not allocate a number or activate phone calls. The existing Render workspace has no database configured for this feature. Configure these server-only variables from `.env.example`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: the account owning the number.
- `IVR_PHONE_NUMBER`: an owned voice-capable E164 number. Provision it in your provider account with the required local registration. The setup script configures an existing number; it does not buy one.
- `IVR_DATABASE_URL`: PostgreSQL connection for durable jobs and profiles. Prefer an internal Render URL in the same region. Use a durable plan for real caller history; an expiring free database is unsuitable for long-term operation.
- `IVR_PUBLIC_BASE_URL=https://ilera-her-ai.onrender.com`.
- `IVR_SESSION_SECRET`: random 32+ character secret for 20-minute signed call state and temporary encrypted answers.
- `IVR_PROFILE_SECRET`: a separate random 32+ character long-lived secret for caller hashes and encrypted health history. Preserve it across deploys. Rotation requires a planned migration; replacing it makes existing profiles inaccessible.
- `IVR_MAINTENANCE_SECRET`: separate random 32+ character secret for retention cleanup.
- Working `HF_TOKEN` with accepted gated-model access and a ready fixed speech runtime. `/api/ivr/status` checks loaded ASR models and the loaded shared text model before advertising availability. This is an availability check; real-language inference still needs acceptance calls. The default text-model runtime is already wired; `NATLAS_LLM_API_URL` can override it with the official self-hosted model.
- `IVR_ENABLED=true` only when the above is ready and acceptance calls have been arranged.

Run `node scripts/configure-ivr-number.mjs` with the provider variables in your trusted environment. It verifies ownership and voice capability before setting the number's voice webhook to HTTPS POST `/api/ivr/incoming`. Alternatively configure the same endpoint in Twilio's number settings. `/api/ivr/status` verifies the owned number's exact webhook and method before displaying a call button. The service remains in setup mode if its readiness checks fail. Use an always-on web service for production calls; a free service that sleeps may miss the provider webhook deadline after a cold start. The existing free Render service has not been upgraded. Do not paste secrets into chat or commit them.

## Language audio

English menus are built in. Only enable native languages in `IVR_TTS_LANGUAGES` after their TTS and native-speaker-reviewed prompt pack have been tested. The HTTPS prompt base serves `<base>/<yo|ha|ig>/<name>.mp3`. Base prompts: `consent`, `record`, `waiting`, `menu`, `error`, `goodbye`. Update `consent` to explain the recording, speech/health processing and temporary 20-minute answers; `menu` must describe key 2 as a follow-up.

For native-language saved history, also supply: `history-choice`, `history-pin`, `history-new-pin`, `history-unavailable`, `history-menu`, `history-delete`, `history-deleted`. Their exact English scripts are in `src/app/api/ivr/profile/route.ts` and `wait/route.ts`; translate and review the privacy terms and keypad choices. Then list only tested prompt languages in `IVR_HISTORY_PROMPT_LANGUAGES`. Without this flag that language stays in guest mode. Do not enable untranslated consent prompts.

## Storage and retention

Schema creation and additive migration run lazily on the configured PostgreSQL database. Caller phone numbers are HMAC hashed with the profile secret; raw numbers and PINs are not stored by the app. PINs use salted scrypt. Health history and temporary question/answer/audio results use AES-256-GCM with separate keys. Twilio itself receives phone numbers, DTMF and recordings; secure its console access and configure provider retention/logging accordingly. Do not enable request-body logging or Twilio debugger collection of PINs.

Profiles expire after 30 days of inactivity. Each history entry expires after 30 days regardless of continued use, and each profile keeps at most 50 entries. Retrieval enforces expiry immediately. Schedule a trusted HTTP job at least daily to POST `/api/ivr/maintenance` with `Authorization: Bearer <IVR_MAINTENANCE_SECRET>` for physical deletion of expired rows. Startup and profile operations also clean expired profiles. Without a scheduled job, physical deletion can lag until the next cleanup. Configure database backup expiry separately; app deletion cannot selectively remove historical backups.

Temporary answers expire at the original call's 20-minute deadline; follow-ups do not extend it. Provider recordings are deleted after worker processing, including failures. Monitor failed recording deletions and remove orphaned provider recordings through the provider's retention process. Jobs use leases to recover callbacks; saving a completed answer and appending history are atomic and idempotent. History deletion locks the profile to prevent an in-flight worker recreating deleted history.

## Acceptance checklist

Automated route and crypto/storage-boundary tests cover signature rejection, consent, caller hashing, guest behavior, PIN lockout, encrypted history, retention filters and deletion. A real database and telephone call are still required to validate infrastructure, audio quality and carrier DTMF behavior.

1. Test each enabled language: consent, clear question, spoken response, replay and follow-up.
2. Enrol on a controlled test number, call again, unlock with the PIN and verify continuity without claiming old symptoms are current.
3. Try an incorrect PIN five times, reconnect and verify lockout; verify guest mode and withheld caller ID.
4. Ask an urgent question, then a short follow-up; confirm urgent care instructions remain audible.
5. Delete with 5 then 1; confirm old replies/history are inaccessible and a later call offers a new PIN.
6. Interrupt callbacks and restart the worker; confirm no duplicate history entries, cross-caller access or leaked health logs. Exercise the scheduled cleanup and provider recording deletion.
