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
  integration test: 245 tests passed after the queued-error regression fix.
  Model responses are explicit doubles.
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

The provided dedicated SIM number is now configured in Render's server
environment (see the activation update below). Remaining dependencies are a
voice-capable gateway model and operator approval, an accessible Linux host on
its LAN/private VPN, securely matched service secrets,
native recordings/review for enabled languages, usable model quota and real call
acceptance. Period records/web-chat history are not used by phone calls; follow-up
context is limited to the call. This scope is explicit in the settings/README.

## Publishing and live adapter checks

- Application commit `142448426b3bccaa1f6a44fe3dacbac1a3df5882` is published on
  main. The remote Git tree exactly matched the locally verified staged tree.
- CI-only follow-up `dff6935f637582caed4a785a9af02ffb7945fb94` installs FFmpeg
  explicitly on the runner. The initial CI run exposed that missing system
  dependency; [run 38056510627](https://github.com/Erioluwa23/ilera-her-ai/actions/runs/38056510627)
  then passed all app/Python tests, the production build and existing runtime tests.
- Existing Render service `srv-dart3h8u01pc73dpngdg` now runs application commit
  `11f7c805f0566c286751d1b162b8aaa8f8ed341d`. Final deployment
  `dep-db543g2jnfac7395ubdg` became live at `2026-10-10T13:48:02.02687Z`.
  The environment merge triggered two initial deployments automatically; one
  manual deploy published the later runtime fix after its CI passed. Auto-deploy
  remains off; no plan was changed.
- The shared app integration secret was generated and configured server-side,
  without committing or printing it. Calling remains disabled and unverified.
- Live HTTP checks: `/api/phone/status` returned 200 with `configured:true`,
  `ready:false`, `phoneNumber:null`; anonymous account and private authentication
  requests returned 401; `/settings/phone` redirected to the existing sign-in page.
  No signed-in production PIN update or physical call is claimed.
- Existing runtime status reported loaded ASR and TTS models, with no verified
  live ASR languages. N-ATLaS generation reported missing approved model access.
  The phone adapter can use the existing explicitly labelled curated fallback;
  generation access and real speech/latency acceptance remain operator tasks.
- A synthetic offline English menu WAV was submitted to live ASR. It returned
  `ASR_EMPTY`/502 in 7.19 seconds, rather than a usable transcription. Inspection
  found Gradio `submit()` status events were not subscribed, hiding queued
  upstream errors. Follow-up `11f7c805f0566c286751d1b162b8aaa8f8ed341d` subscribes
  to data and status, with a regression test for quota errors without data.
  [Run 38056925654](https://github.com/Erioluwa23/ilera-her-ai/actions/runs/38056925654)
  passed all 245 app tests, 13 SIM-service tests, the build and six runtime tests.
- After the fix deployed, the same synthetic English ASR check returned the
  correct sanitized `ASR_QUOTA`/429 in 7.89 seconds. The live phone-status API
  still reports configured, disabled/not ready, with no advertised number.
- A separate non-medical English speech-output check returned 429 (GPU quota)
  in 5.97 seconds. No spoken-answer or ASR accuracy success is claimed. Physical
  activation requires available compute as well as hardware.
- The cloud browser could not open the public app URL (`ERR_BLOCKED_BY_CLIENT`).
  Live checks above used HTTP; visual signed-in/device accessibility QA is pending.
- Concurrent main commit `b9a1dcfde06fea8a0d578b6f889407b5a58f68fd` introduced
  account-stored cycle records after this pilot was implemented. Delivery notes
  were merged onto that commit, preserving its changes. That separate cycle API
  is not wired into phone contexts; the call service still uses only its current
  conversation. These delivery-note changes do not deploy the separate cycle work.

## Activation update — 2026-10-10

- The user supplied the dedicated Nigerian SIM number. It was normalized to
  E.164 and stored as `SIM_PHONE_NUMBER` on the existing Render service through
  an environment merge, preserving all other settings. The update's deployment
  `dep-db549fajnfac7396ilng`, on concurrent main commit
  `4a39c9fff585b19221c5aa403863e5303f5551dc`, became live at
  `2026-10-10T14:01:00.469144Z`. Calling remains paused/unverified; the public
  phone-status endpoint continues to withhold the number. No number is purchased
  and no carrier routing is inferred from configuring this variable.
- Added bearer-authenticated `GET /api/phone/integration/readiness`. Operators
  can inspect the configured number while paused, recent gateway availability,
  prompt languages, separate model loading/access and activation blockers.
  It returns no account/call data or raw provider exceptions. Model loading
  explicitly leaves speech compute untested.
- Added `python -m simcall.doctor --env-file /etc/ileraher-sim-call.env` for the
  native service user. It checks protected configuration, media permissions,
  actual PCM menus, loopback-only API/FastAGI listeners, Asterisk contact,
  app-key matching and readiness. The default is read-only and does not acquire
  GPUs. Optional `--speech-smoke` sends only a fixed English menu and a fixed
  non-medical phrase through the existing ASR/TTS routes, reporting bounded
  format/quota/latency results without logging transcripts or audio. It never
  claims carrier connectivity or pronunciation accuracy. The installer now
  installs `ss`/iproute2 and saves the gateway address on first environment setup.
- Live `/api/natlas/access` returned text-model config access `200`, but `403`
  for the four ASR configs using **Render's** credential. The **Space** separately
  reported all ASR models loaded, speech loaded and text generation unavailable.
  These are different credential contexts. Added an optional approved read-only
  `NATLAS_LLM_HF_TOKEN` Space secret for text generation, retaining the existing
  ASR `HF_TOKEN`. Access-denial and dependency/memory/load failures are now
  reported separately, rather than labeling every load failure an approval issue.
  No new credential or model approval is fabricated by this code change.
- Validation on top of the concurrent cycle changes: all 341 app tests, all 18
  SIM-service tests, all 8 model-runtime boundary tests and the production build
  passed. Real call hardware, speech accuracy and usable live compute remain
  unverified. No accessible dedicated Linux call host or SIM gateway was found
  among the connected services. SSH is installed locally, but no host address,
  SSH configuration or agent was supplied. Hugging Face's connector has read
  permissions; its browser session requires sign-in for account/model settings.
