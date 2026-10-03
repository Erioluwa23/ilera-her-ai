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
