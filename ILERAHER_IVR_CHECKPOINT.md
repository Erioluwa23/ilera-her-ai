# IVR implementation checkpoint — 2026-10-05

User selected Twilio for the ordinary-phone journey. Implemented authenticated POST webhooks, recording consent bound into signed state, bounded language/menu retries, completed-recording callbacks, PostgreSQL jobs with atomic leases and duplicate-callback protection, waiting/replay/new-question menus, encrypted temporary results, provider recording cleanup attempts, signed expiring media playback, and a public readiness endpoint. The Help screen checks readiness before displaying a phone number or call button.

Non-English playback requires tested native-language prompt audio and an external speech endpoint; unsupported Twilio Say locales were removed. N-ATLAS ASR and text providers remain mandatory for the IVR pipeline; no substitute ASR was added. Urgent responses preserve source-grounded care instructions. No caller phone number or transcript is stored in the job table.

Validation: 105 tests pass, including 24 new Twilio call-flow tests. New tests use synthetic identifiers and mocked jobs; they do not prove live calls, actual PostgreSQL behavior, inference accuracy or native-language audio. Targeted lint and production build are run before release. See IVR_SETUP.md for configuration, retention limits and the required real-call test matrix.

Activation is not complete without provider account credentials, an owned voice number/webhook mapping, persistent database, functioning ASR/text inference, and tested playback for enabled languages. No number, paid subscription, database, prompt pack, TTS service or credentials were provisioned by this change. Calls remain disabled until deliberately configured. No live phone call has been made or verified.
