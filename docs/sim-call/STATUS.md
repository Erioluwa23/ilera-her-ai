# SIM pilot delivery checkpoint — 2026-10-10

Implemented in the existing `Erioluwa23/ilera-her-ai` repository, based on main
`22e1ddb19eef3a9f015a547ebbb91205ad135205`.

- Separate Python API/FastAGI service, API-only Docker packaging and native Ubuntu
  installer/systemd deployment. Single-SIM capacity; no Twilio dependency in the
  new service. Existing Twilio routes are preserved for compatibility.
- Registered-user app API adapter and Help → calling PIN/replies screen. Uses the
  existing user/session/database, N-ATLAS ASR/text logic, YarnGPT2b/configured TTS,
  source-grounded urgent guidance and feedback/admin integration.
- Password-protected PIN enrolment, global PIN lockout, per-call authentication,
  recording consent/submission confirmation, bounded inference/upload, reply
  repeat/follow-up/rating, encrypted optional played replies, retention cleanup,
  revocation, one-line capacity and hangup/restart cleanup.
- The app does not display a number until operator verification, activation,
  recent Asterisk gateway heartbeat and ASR/speech readiness are all present.
  Native-language prompt texts/UI strings are draft; reviewed recordings and
  real ASR/spoken-response acceptance are still needed to enable each language.

## Validation evidence

- Existing and new app tests include actual PostgreSQL SQL execution through
  PGlite, all four language adapter paths and a Python-to-TypeScript HTTP
  integration test: 244 tests passed. Model responses are explicit doubles.
- Python tests cover API lifecycle, PIN/consent requirements, limits, expiry,
  upstream failure, hangup cancellation, playback failure, literal leading-zero
  PINs, multipart bytes, actual FFmpeg conversion and a full FastAGI controller
  flow including repeat, follow-up, rating and cleanup against the real call API:
  all 13 tests passed.
- Production Next.js build and TypeScript passed. Existing six Python model-runtime
  lifecycle tests passed. Installer shell syntax and Git whitespace checks passed.
- Isolated Asterisk 20.6 loaded the actual SIP endpoint (G.711 alaw/ulaw,
  IP-restricted gateway, inbound context) and the actual 7000 dialplan with capacity
  and absolute-timeout controls. The configured example peer was unavailable:
  no physical gateway exists here. Loopback transport was used for this parser
  check. No carrier connectivity, RTP conversation or incoming-call success is
  inferred from it. English offline control prompts were actually generated and
  converted to phone WAV.
- There is no paid infrastructure, new purchased number, test user in production,
  real health recording or enabled public SIM number from this work.

## Remaining physical activation dependencies

Actual dedicated SIM number, voice-capable gateway model and operator approval,
an accessible Linux host on its LAN/private VPN, securely matched service secrets,
native recordings/review for enabled languages, usable model quota and real call
acceptance. Browser-only period logs/web-chat history are not available to phone
calls. This limitation is explicit in the settings screen and README.

Publishing/deployment evidence is appended after the remote operation completes.
