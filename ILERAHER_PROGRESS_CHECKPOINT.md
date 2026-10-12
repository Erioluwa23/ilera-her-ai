## 2026-10-12 — ordinary telephone calling

User clarified that access from a basic phone without internet is a major goal.
The Twilio ordinary-phone IVR now uses verified YarnGPT2b audio for all four
reply languages; English provider speech and alternate native TTS were removed
from the health-reply path. Prerecorded consent/keypad controls, playable-pack
readiness and a real-call publication gate were added. Guest calling needs no
app account or PIN; history remains an optional telephone-keypad feature.

The ordinary call number is not activated. The live service lacks carrier
credentials/owned number, the original SIM is not cloud-connected, and the
actual menu-audio preparation attempt was quota-blocked until 17:33:28 WAT.
469 JavaScript tests, production build, TypeScript and targeted lint passed.
See ILERAHER_IVR_CHECKPOINT.md and IVR_SETUP.md for release/activation details.
Do not claim that the in-app call or deployment satisfies an actual carrier call.

## 2026-10-12 — free in-app calling

User authorized a free calling experience that receives spoken replies and asked
for no "sandbox" wording in the interface. Current official Africa's Talking
voice documentation explicitly says its voice sandbox is not operational:
https://help.africastalking.com/en/articles/11532610-voice-sandbox
The earlier recommendation relied on the older general sandbox guide and was
corrected before activation. No Africa's Talking account, live number, paid
service or hardware was provisioned.

Implemented `/call` using the existing application and speech backend. Help and
calling settings now open the in-app voice call; the original dedicated number
remains under contact information. The UI explicitly describes internet use and
shows **Powered by N-ATLaS**, with no sandbox label. The signed-in account starts
an owner-bound call without an extra calling PIN. SIM calls retain their existing
enrollment, PIN and gateway activation rules.

The caller speaks for up to 30 seconds. Speech followed by silence automatically
submits a validated mono 16 kHz WAV; an explicit answer action is also available.
N-ATLaS ASR/LLM and the existing source-grounded guidance produce the response.
YarnGPT2b speaks the reply, next steps and disclaimer for English, Yoruba, Hausa
and Igbo using the existing speaker mappings. The client verifies model,
language, turn and WAV provenance. It acknowledges playback before listening
again; blocked mobile autoplay offers explicit playback without new inference.
Mute, hang-up, page hiding/navigation, six turns and 15-minute expiry bound calls.

App calls use an additive `phone_sessions.channel` migration, hashed grants and
the existing encrypted phone context. Signed-in user/transport binding prevents
cross-account or SIM-grant access. A new call replaces only that user's old app
call. Raw recordings/WAVs are not stored by the application. Reply saving remains
optional and requires completed-playback acknowledgment. End clears temporary
context; a late inference response cannot commit after hang-up. Calls do not read
period records or unrelated saved chats. Model quota errors retain actual retry
timestamps and WAT formatting; a failed spoken reply never becomes a successful
playback or a browser-generated substitute.

Verification: 443 JavaScript checks passed (one existing Python bridge skipped
locally), production build and TypeScript passed, and ten model-runtime contract
checks passed. The focused call suite has 35 checks for app/API/database behavior,
four-language routing, ownership/consent, encrypted follow-ups, invalid audio,
quota deadlines, cancellation, automatic turn-taking, mute, autoplay and timing.
The old SIM speech-unavailable status and stage timeouts remain compatible. The
local Python environment has no pytest; the unchanged Python gateway suite and
cross-runtime bridge are covered by the repository's CI workflow. React review
confirmed effect cleanup, event-driven call initiation, bounded media memory,
accessible labeled controls, mobile layout and reduced-motion support.

See `docs/APP_VOICE_CALLS.md` for transport, consent, configuration and acceptance
details. These checks use controlled media/model fixtures and do not claim live
multilingual pronunciation or successful synthesis while provider quota blocks
inference.

Verified release: commit `27a913e742eb3cb32749525dd13a28e6be4aad79`, tree
`a53b2f73da4cd6acfb9c279225d9af156bc45e92`. CI run `38267825357` passed all
steps, including the PostgreSQL/TypeScript-Python bridge, Python gateway suite,
production build and model-runtime contracts. Render deployment
`dep-db6ff1ss728c738b5la0` is live on the original service, finished
`2026-10-12T15:08:25.462105Z` (16:08:25 WAT).

Production verification used a separate synthetic test account and a synthetic
English caller recording, not a real user's health data. App call startup returned
HTTP 200 without PIN enrollment or gateway activation; hang-up returned HTTP 200,
and optional saved replies remained empty. The actual call turn at
`2026-10-12T15:11:15Z` returned HTTP 429, `ASR_QUOTA`, private/no-store and:

```json
{
  "error": "Quota exhausted. Try again at 12 Oct, 5:33:29 PM WAT.",
  "retryAt": "2026-10-12T16:33:29.239Z",
  "retryAfterSeconds": 4934
}
```

The exact provider deadline therefore reaches the new call API and its existing
translated UI formatter. This call did not produce a successful transcription,
generated answer or spoken reply; live spoken acceptance remains pending compute
availability. No quota workaround, substitute voice or paid upgrade was enabled.

Authenticated production `/call` returned HTTP 200 with Start call, internet
guidance and Powered by N-ATLaS, and no sandbox text in its visible HTML. Published
bundle `/_next/static/chunks/1ipdss7mqy87w.js` returned HTTP 200 with the call API
and YarnGPT model contract and no browser speech synthesis. Health at
`2026-10-12T15:13:09Z` returned HTTP 200, advertised `/call` as browser audio with
internet required, retained `saheedniyi/YarnGPT2b`, and listed all four ASR
languages. Unsigned call starts return HTTP 401; cross-origin starts return 403.
Render error logs since the live deployment were empty. These are API, rendered
HTML and published-asset checks, not a claim of successful live microphone/audio
playback in an authenticated browser. This evidence follow-up is documentation
only; auto-deploy stays off.

## 2026-10-12 — N-ATLaS product attribution

User requested visible N-ATLaS branding to communicate challenge alignment while
retaining YarnGPT's existing speech function. Chat headers, assistant cards and
footers now display **Powered by N-ATLaS**. Generated phone replies use the same
attribution; curated phone replies retain their reviewed-guidance label.

Voice-unavailable and unknown-quota notices no longer name YarnGPT. Cycle insight
listening retains its speech-processing disclosure with generic wording. Exact
legacy speech-error strings in all four interface languages are mapped to current
wording at render time, so previously saved conversations also display the new
notices. Saved records, clinical text, recordings and technical model IDs are not
rewritten. Provider-supplied retry times and WAT formatting remain intact.

YarnGPT still performs TTS for English, Yoruba, Igbo and Hausa. Runtime inference,
speaker routing, `saheedniyi/YarnGPT2b` provenance, model/language header validation,
audio caching and playback remain unchanged. The API's generic unavailable error
text changes, while its status/code and all quota metadata contracts are retained.

61 focused checks passed, covering the existing four-language listening flow,
legacy saved-error display, recorded/saved audio, offline replay, cancellation,
speech provenance, quota deadlines and insight listening. Production build and
TypeScript passed; git diff --check passed. The React best-practices review found
no added effects, requests or dependencies, and retained the existing accessible
controls, responsive header and privacy links.

Verified release: commit `961b348115ebb422fbfe30a9b35f71cbedaded4e`, tree
`3d698d310df41f3cfc9a85cf6e2459554722fafd`; CI run `38259889576` passed.
Render deployment `dep-db6egjflot8c739tooeg` is live on the original service,
finished `2026-10-12T14:03:55.994723Z` (15:03:55 WAT).

The production build's rendered standard/Lite chat HTML contains two/one
N-ATLaS attributions respectively, with no visible YarnGPT label. Unauthenticated
production chat requests correctly redirect to sign-in; the published frontend
chunk `/_next/static/chunks/04ou_uxvevil5.js` returned HTTP 200 and contains the
new attribution and generic speech notices. The rendered assistant/error checks
also passed for saved messages. This is component/build/live-asset verification,
not a claim that an authenticated browser session was visually inspected.

Live health at `2026-10-12T14:12:12Z` returned HTTP 200, with
`ttsModel=saheedniyi/YarnGPT2b`, `llmModel=NCAIR1/N-ATLaS`, and ASR languages
`en-NG`, `yo`, `ha`, `ig`. No inference/model/hardware/secret configuration changed.
This release-evidence follow-up updates documentation only; auto-deploy stays off.

## 2026-10-12 — direct ZeroGPU quota metadata lookup

The prior quota change only read a countdown from an inference error. Its live
responses had no retry timestamp, so the requested actual UI retry time remained
unresolved. Hugging Face's official release/SDK documentation now exposes a
separate authenticated endpoint, `GET /api/spaces/zero-gpu/quota`, with `current`
(remaining GPU-seconds), `resetsAt`, and optional execution-count `runs` metadata:
https://github.com/huggingface/huggingface_hub/pull/5040

The backend now uses the same server credential as Gradio to read that metadata
when a quota failure has no usable countdown. GPU quota uses its absolute reset;
a runs limit uses the runs reset. When both are exhausted, the later deadline is
used. Unrelated Hub rate limits and Space-wide caps do not borrow an account's
reset. The request is read-only, private/no-store, limited to four seconds and
does not follow redirects. Only a future validated timestamp leaves the helper;
no credentials, upstream error text or billing details are exposed to the UI.
The existing speech/transcription API and four-language WAT notices receive that
deadline without a frontend contract change.

The endpoint requires billing-read permission: for fine-grained tokens,
"Billing > Read billing usage and payment method status". Permission or lookup
failure preserves the existing HTTP 429 and generic retry notice; only the HTTP
status is logged for operational diagnosis. No credential values or permissions
were changed.

Local checks: 408 JavaScript tests passed (one existing Python bridge check
skipped locally), production build/TypeScript passed, and git diff --check passed.
94 focused tests cover actual metadata propagation through four-language YarnGPT
failures and queued ASR errors, separate run resets, invalid/past/missing reset
data, API permissions, credential containment and the original countdown path.
Verified release: commit `40e423255b5c20720da983f2f5ad351ad44d097f`, tree
`77c068906ccf47307fef48cc97dd92178f072d3c`. CI run `38256895166` passed.
Render deployment `dep-db6e4ve7bikc73chu2mg` is live on the original service,
finished `2026-10-12T13:38:29.28608Z` (14:38:29 WAT).

The production English speech request at `2026-10-12T13:39:43Z` returned:

```json
{
  "code": "TTS_QUOTA",
  "error": "Quota exhausted. Try again at 12 Oct, 5:33:29 PM WAT.",
  "retryAt": "2026-10-12T16:33:29.229Z",
  "retryAfterSeconds": 10426
}
```

It also returned HTTP 429, `Retry-After: 10426` and private/no-store caching.
The actual transcription endpoint at `13:40:37Z` returned `ASR_QUOTA` with the
same displayed reset time, `retryAt=2026-10-12T16:33:29.001Z` and
`Retry-After: 10372`. That check used a 0.5-second synthetic silent WAV only to
verify quota transport. The existing frontend consumes `retryAt` for the chat,
transcription and cycle-insight notices, formatting it in WAT for all four
interface languages; this contract and React error rendering passed the suite.

The current reported retry time is therefore **12 October 2026, 17:33:29 WAT**.
Fresh inference remains quota-blocked; these responses verify retry-time
propagation, not successful synthesis or pronunciation. No credential values,
permissions, model weights or hardware were changed. This release-evidence
follow-up is documentation only; auto-deploy stays off.

## 2026-10-12 — provider quota retry time in speech errors

User requested the actual quota renewal time in the error message. The installed
Gradio client preserves Hugging Face's error text, but our classifier discarded
its `Try again in H:MM:SS` detail. The existing Python runtime already rethrows
Gradio quota errors, so no model-runtime or hardware change is required.

The application extracts only the provider's positive timedelta (including day
counts/fractional seconds) and converts it to an absolute UTC deadline when the
error is received. It never forwards upstream HTML, links or credential text.
TTS and both transcription API routes now return `retryAt`,
`retryAfterSeconds`, `Retry-After`, HTTP 429 and private/no-store when known.
English, Yoruba, Hausa and Igbo interfaces format the deadline in Africa/Lagos
time as `Quota exhausted. Try again at [date/time] WAT.` Cycle insights use the
same deadline. Missing, zero or malformed provider delays retain a generic retry
message; no midnight or guessed renewal time is substituted. This is a provider
retry estimate, not a guarantee that later inference will succeed.

Hugging Face's current quota guide describes a 24-hour window starting with the
first use, rather than a calendar-day midnight reset:
https://github.com/huggingface/skills/blob/main/skills/huggingface-zerogpu/references/how-quota-works.md
The displayed deadline uses the request's actual provider delay rather than
deriving a deadline from that general policy.

Local verification: 383 JavaScript tests passed (1 existing Python bridge check
skipped locally), production build/TypeScript passed, git diff --check passed.
106 focused tests include date rollover in WAT, all four interface languages,
provider-error propagation, both transcription aliases, TTS retry headers,
unknown delays and preservation of the reply/insight without device speech.
CI run `38221506979` passed for quota implementation commit
`e36ba170dcd0257282e9384a0c35899834f438f7`. Its first Render deployment
`dep-db69a3jbc2fs73ba42ig` failed after the port scan timed out; the existing
YarnGPT release stayed live. The new process had logged readiness on port 10000,
so the logs do not establish why Render could not detect its listener.

Production startup now explicitly binds `0.0.0.0`, as required by Render, while
retaining the platform's `PORT` setting. A local smoke check confirmed an IPv4
wildcard listener on the supplied port and HTTP 200 from the production app.
Binding commit `6893eb3a2f9e0ce881490d7081a1e21982708fbd` passed CI run
`38223793372`. A fresh deployment with its build cache cleared,
`dep-db69kjflk1mc73ceiht0`, is live on the original service at that commit. It
finished `2026-10-12T08:31:11.953789Z` (09:31:11 WAT).

Live `/api/voice/audio` returned HTTP 429 at `2026-10-12T08:32:09Z` with
`TTS_QUOTA` and `Quota exhausted. Please try again later.` The transcription
endpoint returned the matching `ASR_QUOTA` response at `08:32:58Z`, using a
0.5-second synthetic silent WAV to verify quota transport only. Both responses
had private/no-store caching and no `retryAt` or `Retry-After`. Therefore no exact
current renewal time is confirmed; a positive, supported provider countdown is
needed before the application can display one. No reset time was guessed.

Live health returned HTTP 200 at `08:32:19Z`: owned Space RUNNING, reachable,
ASR models loaded, N-ATLaS loaded and YarnGPT loaded (`ttsStage=ready`). Fresh
synthesis and real transcription acceptance remain quota-blocked. This release
evidence follow-up is documentation only; auto-deploy remains off and the
verified application revision above stays deployed.

## 2026-10-12 — YarnGPT is the application speaker

User requested YarnGPT for English, Yoruba, Igbo and Hausa, replacing robotic
browser/device speech. The chat/lite player now generates speech on its existing
Listen action, verifies the returned model/language, persists the WAV and
`audioModel` in IndexedDB, starts playback and reuses the saved audio on replay.
Unknown historical assistant-audio provenance is regenerated on demand before
being identified as YarnGPT; recordings, conversations and downloads are retained.

Cycle insights also use on-demand YarnGPT. Their Listen control discloses sending
only the displayed summary text to the speech service. Full period records are
not sent; no prediction algorithm or LLM is changed. Insight audio is cached only
in memory. Pending requests can be stopped and stale results do not start speech.
No application source invokes browser speech synthesis. There is no device-voice
fallback or `VOICE_TTS_*` override; SIM readiness reflects YarnGPT availability.
Existing ASR, answer generation, SIM activation and dedicated number are preserved.

The existing runtime mapping is English/idera, Yoruba/yoruba_female2,
Igbo/igbo_female2 and Hausa/hausa_female2. Its deployed app.py matches this
repository's runtime source. No Hugging Face weights, hardware, secrets or paid
resources were changed.

Local validation: 363 JavaScript tests passed (1 existing SIM Python bridge check
skipped locally), the production build including TypeScript passed, 10 model-
runtime boundary tests passed, and git diff --check passed. Focused coverage
exercises all four language routes, model/language provenance, saved offline
replay, cancellation, unknown old audio and quota failure without device speech.
React structure, event cleanup, keyboard labels and async request handling were
reviewed using the React best-practices skill. These tests use synthetic responses
and do not establish pronunciation quality or real-device audio acceptance.

Before deployment, live health reported the owned Space RUNNING with both text
and TTS models loaded. A non-sensitive English synthesis test returned HTTP 429
with exhausted speech compute quota. Model loading does not prove available GPU
quota; fresh production speech remains blocked until quota is available.

Verified release: application commit `8eb46c8bdd671b5a748c652b74b051073c7f3117`,
tree `376160c30480ccef731861be6b55b0c529076e31`; Render
`dep-db68u9ijnfac73csicv0` is live on the original service, finished
`2026-10-12T07:42:58.976038Z`. CI run `38219087916` passed all steps, including
JavaScript/PostgreSQL/bridge checks, SIM-service Python tests, the production build
and runtime boundary tests. Auto-deploy remains off; no duplicate deploy started.

Post-deploy health returned HTTP 200 with the owned runtime RUNNING and YarnGPT
loaded (`ttsStage=ready`). Four short, non-sensitive greetings sent to the actual
production speech API each returned HTTP 429 with the new `TTS_QUOTA` code:

| Language | UI code | Actual result | Latency |
|---|---|---|---|
| English | en-NG | 429 / TTS_QUOTA | 9.22 s |
| Yoruba | yo | 429 / TTS_QUOTA | 8.96 s |
| Igbo | ig | 429 / TTS_QUOTA | 9.10 s |
| Hausa | ha | 429 / TTS_QUOTA | 9.12 s |

There were no error-level application logs in the inspected release interval.
These live checks confirm deployed error handling, not successful synthesis or
pronunciation quality. Real spoken-output acceptance remains quota-blocked.
This release-evidence follow-up changes documentation only; application code
remains the verified live revision above.

## 2026-10-05 — spoken replies implementation

- Runtime is deployed to the existing free ZeroGPU Space `Kolade1/ileraHer-natlas-runtime`; latest runtime revision `99ddb12dcc1d2ed20aebfadc4d62c5ab6295e7bf` is RUNNING.
- `/answer` uses gated `NCAIR1/N-ATLaS`, strict provenance, reviewed context and bounded prior dialogue. `/synthesize` uses `saheedniyi/YarnGPT2b` with the author's original WavTokenizer checkpoint, SHA256 validation, vendored decoder/tokenizer source and license notices. Both initialize separately from ASR at startup.
- The app defaults to the fixed owned runtime for answer generation and saved WAV replies. Browser voice chats retain replies in their existing device storage and support replay/download/share. Existing configured external TTS remains an explicit override.
- The upload workflow now triggers for runtime changes on main. Uploads include the complete source dependencies. Published content was audited against local files after correcting an initially incomplete transfer.
- Runtime readiness now uses JSON text, fixing Gradio's queue-disabled Python-repr status response. App health correctly reports all four ASR models loaded and YarnGPT2b/decoder loaded.
- N-ATLaS is not loaded: runtime reports `llmFailure=GatedRepoError`. Kolade1 must obtain approved access to https://huggingface.co/NCAIR1/N-ATLaS and ensure the Space's read-only HF_TOKEN covers that repository, then restart the Space. Do not change GitHub HF_SPACE_WRITE_TOKEN or request token values in chat. Until then the app returns its source-grounded curated answers, labelled curated.
- Live `/api/voice/audio` returned verified 24 kHz WAV audio for Yoruba (82,604 bytes, 1.72 s) and Igbo (32,684 bytes, 0.68 s). The runtime's public English synthesis endpoint also returned an audio file with YarnGPT2b provenance. English and Hausa also returned audio files from the runtime with matching YarnGPT2b language/model provenance. Subsequent Render English/Hausa attempts returned 502; after error handling was deployed, an English request returned 429 with an explicit GPU-quota-exhausted response. Further production inference needs quota to recover. These checks verify audio generation/transport, not pronunciation or clinical translation accuracy.
- Added a repetition guard for heavily repeated ASR text, and structured Gradio quota classification with an explicit 429 audio response.
- Validation: 128 JavaScript tests, 6 Python runtime boundary tests, production build passed. GitHub CI passed at 621c525; runtime upload passed at 570a817. Render deployment dep-db1sqocs728c73e04um0 is live at 621c525. ESLint remains unavailable because this existing repo has no ESLint v9 config. No paid infrastructure was enabled.

# ÌleraHer ASR repair checkpoint — 2026-10-03

## Inspected state

- Repository: Erioluwa23/ilera-her-ai; connected GitHub identity confirmed Erioluwa23.
- Initial main HEAD: 0f945d018386a4492b14378d3853c4ef31aea5bb. Latest CI run 37152907050 failed.
- No repository AGENTS.md was present.
- Render identity/target confirmed: service srv-dart3h8u01pc73dpngdg in workspace tea-darsrfm0tbcc73ctmli0. Correct repository, main branch, free service, autoDeploy=yes, trigger=commit.
- Initial live deployment: dep-db0m4l1srm7s7386uarg, commit 3214bea66f7de2eca4dd05f5d1e917d135ddbc36. GitHub HEAD was not live.
- Existing Space Erioluwa24/ileraher-natlas-runtime: SDK static, revision 07dbc8727950fc7f234b071766d9c8c1a281891e, runtime stage RUNNING, no allocated compute hardware. Files: .gitattributes, README.md, index.html, style.css. No Python runtime exists in the Space.
- HF connector account Erioluwa24, PRO=false; OAuth scopes jobs/openid/profile/read-mcp/read-repos. No repository write scope.
- TinyFish Default profile prof_b805b0226cb74272 has no recorded HF sign-in. Secure setup URL was returned; setup_started=false. User must open it and save the profile before authenticated inspection.
- Current official HF documentation: free personal ZeroGPU hosting requires verified email, account age over 30 days, at most 2 Spaces. Gradio/Docker CPU compute creation requires a paid plan. Actual account eligibility remains unverified. No hardware or subscription was changed.
- Old live /lite returned HTTP 200. Old live health reports a token configured; old /api/natlas/access returned HTTP 400 for every model. The old implementation queried metadata rather than gated files: access is NOT verified.

## Repairs in this revision

- Removed duplicate transcribeFile definition (build blocker).
- One fixed ASR target: the owned existing Space. Removed obsolete ASR endpoint routing after auditing web/lite/API/IVR callers. LLM selection is preserved.
- JS @gradio/client sends Blob bytes to explicit /transcribe. Authentication uses installed SDK's token option, supporting environment credentials and /etc/secrets/HF_TOKEN. No token values were read or printed.
- Blob caller (including IVR) and legacy server file caller use the same ASR provider; route no longer creates temporary files.
- Strict language aliases with unsupported-language rejection. Only missing language defaults to Nigerian English.
- Streaming request cap before multipart parsing; empty/oversized/malformed/type/container validation; upload deadline, upstream deadline, cancellation and session cleanup.
- Strict structured model/language/provider verification; no fabricated response metadata. Safe typed upstream errors without raw exception/token/health-data exposure.
- Health distinguishes target configured, Gradio reachability, gated access/model loading, and successful per-language inference observed by this process. Static Space is never ASR-ready. This is NOT an accuracy benchmark.
- Access probe now requests each gated config.json with authentication and a bounded wait.
- Startup checks use the fixed target and log only safe infrastructure facts.
- Voice interfaces freeze language for the request, prevent duplicate recording/submission, stop at 60 seconds, release tracks and preserve transcripts when answers fail. Speech playback checks actual matching voices.
- Runtime code follows ZeroGPU startup CUDA placement, preloads four official FP16 checkpoints at their resolved revisions, serializes inference, bounds FFmpeg decoding and queue size, removes processed uploads and periodically removes abandoned Gradio cache files.
- Application lockfile and npm ci make installs reproducible. Runtime dependencies and ffmpeg are documented. Startup memory/ZeroGPU compatibility remain unverified on real hardware.

## Verification

- npm test: 75 tests passed; includes aliases, mappings, upload failures, bounded chunked requests, actual installed SDK multipart byte serialization, provenance rejection, sanitized errors, cancellation, timeout, Static readiness, web/API fields and IVR Blob-provider compatibility.
- npm run build: passed. Homepage, /lite, ASR API alias and IVR routes compile.
- Runtime upload lifecycle: 4 isolated Python tests passed, including success/error cleanup and preventing deletion outside Gradio cache. These do not load weights or prove inference.
- python -m py_compile services/ileraher-natlas-space/app.py: passed (syntax only).
- Local browser daemon failed twice before navigation; browser interaction/visual verification unavailable. Local loopback HTTP was also unreachable from separate tool executions. Do not infer UI validation from the build.
- Real speech tests: NOT RUN. No functioning ASR compute runtime currently exists. No silence fixture was counted as a speech success.
- Text generation: not tested. IVR: no connected number/provider or actual call test verified. The existing telephony speech locales are unverified.

## Real ASR evidence

| Language | Required checkpoint | Fixture / expected words | Actual transcript / model / provenance | HTTP / latency |
|---|---|---|---|---|
| Nigerian English | NCAIR1/NigerianAccentedEnglish | Not run; runtime blocked | Unverified | Not measured |
| Yoruba | NCAIR1/Yoruba-ASR | Not run; runtime blocked | Unverified | Not measured |
| Hausa | NCAIR1/Hausa-ASR | Not run; runtime blocked | Unverified | Not measured |
| Igbo | NCAIR1/Igbo-ASR | Not run; runtime blocked | Unverified | Not measured |

## Next action / blockers

1. User opens secure TinyFish setup, signs in as Erioluwa24 and clicks Save profile. No password/token should be sent in chat.
2. Inspect authenticated Space settings and account verified-email/age/ZeroGPU eligibility. If free ZeroGPU unavailable, report exact restriction; do not upgrade, create replacement Spaces, or bypass entitlement via metadata.
3. If permitted, deploy the existing services/ileraher-natlas-space files to the existing Space and select actual ZeroGPU hardware. Only after server compute is confirmed, securely enter a separate read-only HF_TOKEN Space secret authorized for all four gated checkpoints. Never copy a token to Static client configuration.
4. Check gated files, runtime build/startup logs, loaded checkpoint revisions, RAM and explicit /transcribe contract.
5. Run consented/licensed non-sensitive speech through production Render in all four languages. Record expected words, exact transcript/model/provenance/HTTP/latency and limitations here. Verify actual memory behavior and quota errors.
6. Verify actual Render live commit after auto-deploy. Record deployment identifiers below. No duplicate manual deploy if auto-deploy starts.

## Deployment follow-up (verified)

- Repair code: 2f8dee7d76da9495af3c49c7e8461b3144f27a4f; CI 37155778168 succeeded.
- Live application revision: d31b340ef4b99b0b9baa699bcbaec27dbbb6aa0c; CI 37155896058 succeeded (75 JS tests, production build, 4 Python lifecycle tests).
- Render deployment: dep-db0ncnk9v7es73c755ig, status live, finished 2026-10-03T21:42:01.552196Z. Repeated checks showed no automatic deployment after successful CI. One cleared-cache deployment was requested; no duplicate deployment was started.
- Actual production /api/health: HTTP 200; fixed owned Space target configured; SDK static; runtime reachable=false; asrReady=false; inferenceTested=false.
- Actual production /lite: HTTP 200.
- Actual production /api/natlas/access now requests gated config.json files: N-ATLaS text config HTTP 200; ALL FOUR ASR configs HTTP 403. The existing Render credential is recognized but lacks effective access to these ASR files. Public metadata does not prove access.
- Text LLM is not configured on the live revision; health reports curated-fallback. No generative N-ATLAS text inference was tested.
- Public Static client inspection found no HF-token pattern in fetched HTML, but this is a limited check, not a guarantee about all files/settings. No secrets were entered or exposed by this work.
- HF Space revision remains 07dbc8727950fc7f234b071766d9c8c1a281891e, SDK static, no current/requested compute hardware. No HF files, hardware or secrets were modified.
- Final repository follow-up only updates checkpoint and the undeployed Space scaffold (quotes Python version metadata, enables Whisper long-form timestamp generation). It does not change the live Render application code and is not evidence of a deployed Space.

## Exact continuation

Secure sign-in as Erioluwa24 and Save profile is needed to inspect actual ZeroGPU eligibility and the four model access forms. Verify/obtain approved gated access for the identity owning the runtime read token; if a new token is needed, enter it only through secure server-secret settings. Do not send credentials in chat. Confirm compute before entering any Space secret. Then deploy the existing runtime, verify loaded revisions and memory, and perform four real production speech tests. Live ASR remains blocked; text generation and actual IVR calls remain unverified.


## 2026-10-03: user-authorized runtime owner change

User selected `Kolade1/ileraHer-natlas-runtime` as the new runtime target. Public Hub API confirms revision `0e1b110b350bfa8f567377f89410e24dec41ae8b`, SDK Gradio, stage NO_APP_FILE, requested hardware zero-a10g (current hardware null), files README.md and .gitattributes only. This is evidence of requested ZeroGPU, not a successfully allocated or tested runtime. Existing README uses Gradio 6.29.1 and Python 3.12; upload the prepared runtime README together with app.py, requirements.txt and packages.txt to align the pinned runtime versions.

Application fixed Space ID and current provisioning documentation now target Kolade1. Earlier Erioluwa24 Space findings above are historical. The connected HF identity remains Erioluwa24, with read/job scopes and no repo-write scope. Cloud browser login previously rejected with CloudFront 403; do not retry rejected authentication or claim the user's local login authenticates the agent. No files or secrets have been uploaded to the new Space. Runtime gated access and all four real speech tests remain pending.

## 2026-10-05: verified current stage and upload continuation

- Hugging Face connector now verified as Kolade1. Its OAuth scopes remain jobs/openid/profile/read-mcp/read-repos; there is no repository-write capability. Reconnecting fixed the identity but cannot grant upload through this connector.
- Render latest live deployment dep-db1q3u8u01pc73fjhd90 runs 8b9981976b84306407ca7fbc67e2898d855461c7, finished 2026-10-05T13:12:50.670696Z. The voice-first multi-page frontend and calendar are deployed. See ILERAHER_FRONTEND_CHECKPOINT.md for frontend verification and limitations.
- Production health HTTP 200 now targets Kolade1/ileraHer-natlas-runtime; ASR ready=false; runtime unreachable; model access/inference unverified; LLM remains curated-fallback.
- Space unchanged at 0e1b110b350bfa8f567377f89410e24dec41ae8b: Gradio, NO_APP_FILE, ZeroGPU requested/current hardware null, only README.md and .gitattributes. No runtime or secrets uploaded by this session.
- Added manual-only GitHub Actions workflow Upload IleraHer Hugging Face runtime. It uploads exactly app.py, requirements.txt, packages.txt and README.md in one atomic commit to the existing Space, checks token owner Kolade1 and Gradio/ZeroGPU requested, and rejects concurrent Space changes. It does not change hardware, create resources or enter runtime secrets. Syntax/file checks passed; no credentialed upload executed.
- Next user action: create a fine-grained HF token with write access only to Kolade1/ileraHer-natlas-runtime, and save it as GitHub repository Actions secret HF_SPACE_WRITE_TOKEN. Never send it in chat. After that, trigger the manual workflow from main (agent may trigger if supported). Verify actual Space build. Separately add a read-only gated-model-authorized HF_TOKEN to Space secrets; existing Render token previously returned 403 for all four ASR files. Then verify runtime status and run real speech tests for all four languages. Do not claim end-to-end speech success before those tests.

## 2026-10-05: first upload workflow failed at account guard

Run 37326759383 (commit 5517bba3ffff09d9c8d87bdbc9faccd884bf48e6), upload job 111819393018: checkout and dependency installation succeeded; secret present and whoami request returned; account guard failed with "The upload credential must belong to Kolade1." No create_commit call was reached and no files uploaded. Logs do not identify the returned account, so its identity is unknown. Updated guard to compare username case-insensitively and report only the public account name, without printing tokens/raw exceptions. Script syntax and capitalization handling checked locally. Next run must select latest main (rerunning the old run uses old code). If the public account differs, user must replace HF_SPACE_WRITE_TOKEN with a Space-scoped write token created while signed into Kolade1. ChatGPT's connected identity and the GitHub upload secret are separate credentials.

## 2026-10-05: runtime upload succeeded

After user replaced the GitHub secret, agent retried failed jobs in run 37327583141. Latest upload job 111827793385 completed successfully. Four runtime files uploaded atomically at Space revision e6bf53134e5c820043331990a055b0cfa71621fd. Public Hub metadata independently confirms README.md, app.py, requirements.txt, packages.txt plus original .gitattributes; stage BUILDING; ZeroGPU requested, current hardware null. No tokens were read or printed. No Space secret or hardware settings were changed. Build completion, actual hardware allocation, runtime HF_TOKEN availability/gated-model access and four real speech tests remain unverified. Next: check build/startup, have user securely add a separate read-only model-authorized HF_TOKEN Space secret if missing, and verify /status before inference. Upload credential belongs only in GitHub Actions and is not the runtime read token.

Startup follow-up: build completed, but runtime moved to RUNTIME_ERROR at the same Space revision. Public Hub errorMessage explicitly reports app.py line 18: "Server-side HF_TOKEN Space secret is required." Public /config returns HTTP 503. Confirmed next blocker is a missing HF_TOKEN Space secret, not the GitHub upload credential. User must add the separately gated-model-authorized read token in the existing Gradio Space's Settings → Secrets, then verify startup again. No inference tests can run yet.

## 2026-10-10 — product engineer design package implementation

Implemented the latest supplied 16-screen design on main, directly after 5dea08e.
See docs/ui-ux/VERIFICATION.md for the implementation, tests and actual QA limits.
The original handoff and exact tokens are retained in docs/ui-ux. No sample health
records are seeded. Existing browser period/voice storage and required model/IVR
integrations are preserved; preview/d3c1c28 is not merged or deployed.

Final validation: production build/TypeScript, 223 JavaScript tests and six Python
runtime lifecycle tests. Workflow tests verify that stop/60-second stop never uploads,
transcription and Send are explicit, offline drafts remain unsent, storage failure
never claims saved, and edited daily records preserve other episodes/earlier notes.
Initial new-test issues (button wording, mock timer installation and a test's Storage
this type) were corrected. An empty audio src warning and draft-write ordering were
also corrected. Native translation review and signed-in browser/device screenshots
remain pending: local cloud-browser connection is refused, and secure app sign-in
was taken over without an observed successful session. No model-inference or incoming
phone-call success is inferred from this frontend work.

Target deployment: existing original service srv-dart3h8u01pc73dpngdg, branch main,
auto-deploy remains off. Deployment result will be recorded after confirmation.

### Confirmed deployment result

- Published application commit: 26323cd4aced96d29b5367fa29620949f396afb1;
  parent 5dea08e6b4231675c8b8ecf524d8d220ac5aa2c0; tested/published tree
  5b88d177afbde06934284c93a3bba7648673c11a.
- GitHub CI push run 38052170544 completed successfully. The connector's dedicated
  workflow wrapper filters to pull-request runs; CI success was verified instead
  through the approved repository Actions GET endpoint for this exact commit.
- Render dep-db52vl3rjlhs73c85lo0 is live on the original service, finished
  2026-10-10T12:31:55.917344Z. No duplicate deployment or paid resource change.
- Cloud Browser observed the deployed flower branding, updated palette and four-
  language sign-in selector. Protected application screens still redirect to sign-in;
  their real-device screenshot/keyboard/200% text QA and real speech calls remain
  unverified. Public health/manifest/SW retrieval through web search was inaccessible;
  no live API health assertion is made from that failed retrieval.
- Fetched and verified preview/d3c1c28 remains at the exact d3c1c28 revision and is
  not an ancestor of published main. The preview Render app was not changed.
- This deployment-result follow-up changes documentation only. The live application
code remains 26323cd; automatic deployment stays off.

# 2026-10-10 — separate SIM-call pilot

Implemented the independently deployable service in `services/ileraher-sim-call`
and authenticated registered-user adapter in `/api/phone`. Calling PIN/replies UI
is `/settings/phone`, linked from Help. Existing account, N-ATLAS, YarnGPT2b,
reviewed health logic and feedback features are reused. Period records and web
chat history are not used by phone calls; no fake server history is seeded.

See `docs/sim-call/STATUS.md`, `docs/sim-call/API.md` and the service README for
implementation, validation, deployment and exact activation dependencies. The
pilot remains disabled/unverified until physical SIM-gateway acceptance; no
example phone number is advertised. No paid resource was provisioned.

Published application commit `142448426b3bccaa1f6a44fe3dacbac1a3df5882` is live
on the original Render service (`dep-db53v8fmphoc739dkct0`). CI follow-up
`dff6935f637582caed4a785a9af02ffb7945fb94` installs the FFmpeg test dependency;
Actions run `38056510627` passed 244 app tests, 13 SIM-service tests, the production
build and six model-runtime tests. Live anonymous API/status/redirect checks passed.
The integration key is configured server-side; SIM calling stays disabled and
unverified. Physical gateway/number/host and native speech acceptance remain needed.
N-ATLaS text access remains unapproved; the labelled existing curated fallback is
available. See the SIM status document for evidence and exact QA limits.

Synthetic live speech checks exposed a missing subscription to Gradio queued
failure events. Fix `11f7c805f0566c286751d1b162b8aaa8f8ed341d` enables status/data
events; CI run `38056925654` passed 245 app tests, 13 service tests, the build and
six runtime tests. Live TTS returned a compute-quota 429; real speech success and
hardware calling remain unverified. Render `dep-db543g2jnfac7395ubdg` is live on
that exact fix commit, finished `2026-10-10T13:48:02.02687Z`. The subsequent live
ASR check now reports `ASR_QUOTA`/429 correctly. Phone status still hides the number.
This evidence follow-up changes documentation only; auto-deploy remains off.
Concurrent cycle-prediction commit `b9a1dcfde06fea8a0d578b6f889407b5a58f68fd`
is preserved when merging these notes. Its new account-stored period records are
not wired into phone contexts; the pilot uses only the current call dialogue.

# 2026-10-10 — private adaptive cycle prediction delivered

Application commit `b9a1dcfde06fea8a0d578b6f889407b5a58f68fd` adds PACPE
`pacpe-1.0.0` inside the existing Next.js server. It preserves the SIM pilot and
queued speech-error fixes. Period logging/editing now uses authenticated,
owner-scoped PostgreSQL APIs with explicit consent, encrypted health payloads,
versioned forecasts, original-outcome evaluation, private export and deletion.
Browser history requires a manual ownership-confirmed import; it is never
silently uploaded. Missing records and relevant cycle context pause/reset dates.

My Cycle and History use the API's actual calculated dates. The interactive
calendar includes cautious reliability, overdue treatment and opt-in in-app
reminders. Insight playback uses local device voices on demand; no cycle health
payload is sent to an LLM or cloud speech provider. Prediction windows stay absent
until at least six usable cycles and eight real prospective outcomes in the same
model/history regime. See `docs/cycle-prediction/README.md` for policy and limits.

CI run `38057223888` passed 337 app tests (including PostgreSQL 16 transactions),
13 SIM-service Python tests, six model-runtime Python tests and the production
build. Documentation-only revision `2828f2e9fcd299b82f51679aef9b02eb41249e9a`
also passed CI `38057381094` and contains the same tested application code.
Render `dep-db546jnlot8c73dlolug` became live on that exact combined revision at
`2026-10-10T13:54:44.906304Z` on the original service. The dedicated encryption
key is configured server-side and must remain stable; no value was committed or
printed. No paid infrastructure or preview deployment was changed.

Live HTTP checks: `/api/health` returned 200, `no-store`, model `pacpe-1.0.0` and
`storageReady:true`; `/api/v1/cycles/prediction` returned 401,
`private, no-store` and `sign_in_required` without authentication. The browser
could not open the health page (`ERR_BLOCKED_BY_CLIENT`), so these checks used
HTTP. Signed-in visual/device audio QA and native-speaker review are pending.
Synthetic tests do not establish clinical accuracy; real pilot errors and later
window coverage still need measurement. Phone cycle-history integration is not
enabled. The rejected `d3c1c28` preview remains outside main.

This deployment-evidence follow-up changes documentation only. Automatic Render
deployment remains off; the live application code is the verified revision above.
