# Ordinary telephone update — 2026-10-12

The user explicitly renewed the no-internet/basic-phone goal after the in-app
call was identified as requiring internet. The ordinary telephone transport
uses the existing signed Twilio IVR; no new browser-call substitute was added.
The caller does not need an app account or internet, and optional PIN history
is enrolled through the telephone keypad.

Updated the worker to synthesize actual YarnGPT2b WAV replies for English,
Yoruba, Hausa and Igbo. Removed English provider speech and the alternate
native-language TTS adapter from health replies. Jobs retain model/language
metadata; replay and media reject text-only, wrong-model or wrong-language
audio. The lease and wait budget now include transcription and synthesis.
Source-grounded urgent guidance and provider recording cleanup remain intact.

Added multilingual draft consent/control scripts and a resumable YarnGPT menu
preparation script. Active-call controls play recorded WAVs, including English;
there is no GPU call just to present consent or keypad instructions. Readiness
requires loaded YarnGPT plus the exact script/audio checksums for every required
control. No language-review or successful recording generation is claimed.

Help displays ordinary calls separately from internet calls, with normal airtime
guidance. It publishes a telephone number only when all setup checks pass,
IVR_ENABLED is true and IVR_PHONE_VERIFIED records completed real-call acceptance.
Health/status metadata identifies telephone transport, no caller internet and
no app-account requirement. No "sandbox" wording was added to the interface.

Validation: 469 JavaScript tests passed, one optional Python-bridge test skipped
locally; production build and TypeScript passed. Targeted Next.js/TypeScript lint
passed using the installed official rule sets (the repository has no lint config).
The 93 focused telephone tests include all four YarnGPT languages, failure
cleanup, signed consent/media, guest entry, prompt integrity and publication gates.

Live pre-activation checks confirm database and N-ATLaS ASR/LLM readiness, but
TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN and IVR_PHONE_NUMBER are not configured.
The existing +234 806 567 8634 SIM has not been bridged or forwarded to a cloud
carrier. Browser access to Twilio currently stops at the email sign-in form.
No phone number, paid upgrade, recharge, carrier connection or nonprofit
application has been purchased/submitted, and no real telephone call was verified.

Actual preparation attempt through the existing audio endpoint returned the
speech quota deadline 2026-10-12T16:33:28.382Z (17:33:28 WAT). No prompt WAVs were
generated. Resume after the actual quota renewal, review the recordings, connect
an approved provider number and perform the basic-phone acceptance matrix in
IVR_SETUP.md before enabling public telephone access. Deployment alone is not
ordinary telephone activation.

# Historical IVR implementation checkpoint — 2026-10-05

User selected Twilio for the ordinary-phone journey. Implemented authenticated POST webhooks, recording consent bound into signed state, bounded language/menu retries, completed-recording callbacks, PostgreSQL jobs with atomic leases and duplicate-callback protection, waiting/replay/new-question menus, encrypted temporary results, provider recording cleanup attempts, signed expiring media playback, and a public readiness endpoint. The Help screen checks readiness before displaying a phone number or call button.

Non-English playback requires tested native-language prompt audio and an external speech endpoint; unsupported Twilio Say locales were removed. N-ATLAS ASR and text providers remain mandatory for the IVR pipeline; no substitute ASR was added. Urgent responses preserve source-grounded care instructions. No caller phone number or transcript is stored in the job table.

Validation: 105 tests pass, including 24 new Twilio call-flow tests. New tests use synthetic identifiers and mocked jobs; they do not prove live calls, actual PostgreSQL behavior, inference accuracy or native-language audio. Targeted lint and production build are run before release. See IVR_SETUP.md for configuration, retention limits and the required real-call test matrix.

Activation is not complete without provider account credentials, an owned voice number/webhook mapping, persistent database, functioning ASR/text inference, and tested playback for enabled languages. No number, paid subscription, database, prompt pack, TTS service or credentials were provisioned by this change. Calls remain disabled until deliberately configured. No live phone call has been made or verified.
