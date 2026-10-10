# Implementation handoff — 2026-10-10

The user's initial request was “Implement.” The three uploaded documents were treated as implementation specifications; their references to clinical sign-off and human evaluation do not establish completed reviews. The user subsequently explicitly requested “Deploy.” Changes are prepared in `/workspace/ilera-her-ai`, branch `work`, based on `16e4f62`. The deployment push dry run failed with HTTP 403 because connected GitHub account `Atanseiye` lacks write access to `Erioluwa23/ilera-her-ai`. No remote push or deployment was performed. See [deployment continuation](DEPLOY_RENDER.md).

## Connected implementation

- Four destinations: Home, Track, Ask and History, with public Help and account Settings. Existing `/log`, `/cycle`, `/voice`, `/history`, `/lite`, auth, feedback, phone and admin routes remain. Allowlisted return targets preserve valid dates and record/thread IDs.
- Language/purpose → optional focus → privacy onboarding; focus changes create no health records. Conversation retention starts in memory. Device text retention, audio retention and external AI are separate choices. Shared-device mode hides previews and keeps new conversations/drafts in memory; explicit health-record saves remain on the device.
- Period Dates → optional Details → Review → successful persistence. Unanswered flow/pain are null; zero is an explicit choice. Validation preserves drafts, editing preserves old notes, commits have stable IDs and a duplicate guard, deletion confirms scope. Calendar and List expose equivalent dates and record flags. Today follows Lagos civil dates and refreshes at local midnight or tab focus.
- Voice records only after a notice and explicit Record. N-ATLAS/NCAIR ASR is retained. Transcript review precedes guidance; language is frozen for the recording. Cancellation/navigation stop recording/playback and discard late responses. Guided topics remain usable after microphone denial. Old-thread follow-ups ask whether earlier symptoms are current; no automatic TTS playback occurs.
- Account-scoped local health data and IndexedDB conversations. Legacy period notes, IDs, language, reply ancestry and audio are copied only after ownership confirmation; original stores remain intact. Repeated recovery does not duplicate or overwrite newer scoped messages. Changing future audio-retention preferences preserves previously retained audio.
- Unified History filters/paginates records, previews selected exports and required parent profiles, and confirms scoped deletion. Settings validates and previews version-3 health JSON, with explicit child mapping and conflict refusal. Health JSON restore is idempotent. Conversation text and per-message audio downloads are separate; there is no conversation/audio-file import workflow.
- Pregnancy records preserve clinician EDD precedence, change history and paused/ended state. Baby profiles are independent records with actual birth dates. Multi-child measurement review preserves raw values/units/methods and normalized values. Trying-to-conceive, test and user-entered appointment records are available. They do not create diagnoses, book appointments, contact providers or promise notifications.
- Domain date, period, fertility, pregnancy, testing, conception, baby-age, unit, descriptive-change, corrected-age and LMS calculations are isolated from presentation. `/api/health/result` authenticates and recomputes record-only facts from validated records; client result/date/score/care-action claims are ignored. It is stateless and does not upload records to an AI provider.
- Server-only Groq Chat Completions → OpenAI Responses → basic templates. Adapters use strict JSON, bounded evidence/fact tokens, actual provenance, one attempt/provider, cancellation, 25-second total budget, refusal handling and a primary circuit breaker. `AI_PROVIDER_MODE=natlas` preserves the explicit demonstration path. Phone explanations use the shared adapter when separately enabled; default phone external AI is off.
- Service worker caches public offline help and static assets only. Authenticated HTML, RSC, APIs and recordings are excluded. Lite loads voice controls on demand and uses the same stores/retention rules.

## Availability and release gates

| Capability | Available now                                                               | Withheld                                                                            |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Periods    | Logging, corrections, descriptive dates/history                             | Personal forecasts while period policy is draft                                     |
| Ask        | Confirmed voice and guided basic information; optional external explanation | Live-service readiness is unverified in this session                                |
| Fertility  | Education and explicit eligibility choices                                  | Personalized calendar windows and contraceptive certainty                           |
| Pregnancy  | Provider-date arithmetic, saved details/status/appointments                 | LMP/adjusted dating, stage content and clinical schedules                           |
| Conception | Confirmed trying start, elapsed calendar months, discussion checklist       | Referral thresholds and probabilities                                               |
| Baby       | Independent profiles, chronological age, generic access to help             | Personalized newborn/maternal guidance and preterm interpretation                   |
| Growth     | Measurement recording/conversion/history/descriptive change                 | Production WHO table lookup, percentiles, chart interpretation and projected curves |

All new policy records in `src/lib/health/policies.ts` remain `draft`, with null reviewer/review/expiry. Publication checks reject missing, invalid or expired sign-off. The care-content registry requires clinical approval plus an approved translation; its candidate entries have no approved passages. Existing knowledge templates were retained from the repository and were not clinically revalidated here. New UI navigation/form copy supports the four language choices; complex new modules explicitly show English fallback. Full localization and native-language clinical review remain unfinished.

## Verification evidence

See `artifacts/browser-results.json`, `artifacts/accessibility-results.json`, `artifacts/lite-transfer.json`, `artifacts/screenshots/`, and [acceptance coverage](ACCEPTANCE_COVERAGE.md). All browser records, transcripts, credentials and audio are synthetic fixtures.

Final checks: **556 tests across 29 files passed; 16/16 browser journeys passed; production build passed; lint passed with one pre-existing unused-argument warning in `natlas-space.test.ts`; `git diff --check` passed.** The axe scan reported zero violations across its 16-screen coverage. There are 38 screenshots. Lite initial encoded transfer was 162,614 bytes versus 173,373 bytes for full Ask (10,759 bytes saved, about 6.2%); both are below 350 KB in this local fixture.

- Unit/contract tests cover date boundaries, unknowns, policy gates, provider errors/refusal/cancellation, server recomputation, migration, account isolation, quota failure and scoped deletion.
- Independent WHO reference-process fixtures: 304 LMS/score cases and 10 normalization/availability cases. See [source pin, checksums and limits](../reference-fixtures/README.md). Supplied-LMS arithmetic equivalence does not establish complete WHO engine or clinical readiness.
- Browser journeys exercise persisted period review/edit/delete, failed-save draft retention, explicit legacy recovery, two-account isolation, clinician-date precedence/pause, two children/different units, transcript-before-guidance, session-only retention, onboarding return targets, idempotent/invalid import, microphone denial, feedback and phone failure, offline cache privacy, recording cleanup and late-response cancellation.
- Automated WCAG scans cover initial current and record-only screens. Keyboard checks cover skip focus and safe initial destructive-dialog focus. Layout checks cover 320/360/390/768/1024/1440 widths, 200% simulated text scaling, four language choices and long Yoruba labels. These are browser checks, not human screen-reader or moderated accessibility validation.
- Lite initial encoded transfer is measured in fresh Chromium contexts against the local production server, excluding API calls. The final measurement is in `artifacts/lite-transfer.json`; the 350 KB budget is asserted. Compression and hosting affect production transfer and timing.

## Reproduce

```sh
npm ci
npm test
npm run lint
npm run build
```

Browser fixture server (never use this known fixture secret in production):

```sh
AUTH_SECRET=local-browser-fixture-secret-ileraher-2026 npm start
npx playwright test
```

The Playwright config uses `/usr/bin/chromium` and fake microphone input. Override `executablePath` for another machine. Authentication cookies are signed synthetic fixtures; actual registration/login persistence requires a configured database and remains a separate live integration check. Start instructions and provider variables are in `.env.example`. Browser execution does not require real Groq/OpenAI/Twilio credentials.

## Online/offline boundary

Already-open authenticated screens can use device records and local forms offline. Genuinely retained recordings can be replayed locally. New recognition, external AI, external TTS, authentication, feedback submission and phone-readiness checks require network/service access. A protected-page cold reload offline shows public offline help instead of a cached account page. Memory conversations/drafts do not survive a hard reload. Structured writes use Web Locks where available; older browsers without that API should use one editing tab because cross-tab atomicity is not guaranteed. No cloud backup, cross-device synchronization or background reminder delivery is claimed.

## Exact continuation point

1. Configure server credentials and an integration database in an authorized test environment. Separately verify actual Groq success, OpenAI fallback, ASR per language, matching-language TTS, authenticated persistence and a real phone call. No configured credentials were available in this session; mocked transport proves contracts only. Past checkpoint deployment claims were not reverified.
2. Decide production licensing for official WHO tables/reference integration. Implement full pinned table lookup and indicator normalization, then expand independent fixtures over missing/error availability and every flag boundary before enabling comparisons. The current oracle/algorithms do not finish W1.
3. Obtain maternal, reproductive-health and paediatric review for candidate policies/content, then native review of UI, explanations, urgent-care meaning and audio in all four languages. Fill reviewer/date/expiry/translation metadata rather than changing an environment flag to bypass review.
4. Complete remaining language coverage, human keyboard/screen-reader/zoom checks on low-end Android and the required consented pilot: at least 20 adults, five per language, plus voice examples from at least five speakers/language. Publish results by language; no pilot outcomes are claimed.
5. Review cross-provider retention/processing and phone consent before enabling `IVR_EXTERNAL_AI_ENABLED=true`. Circuit state is process-local; production fleet rate limiting/monitoring requires operational configuration. Product analytics remain disabled.

The attached specifications' full clinical/product release definition of done is not complete. This handoff provides the current engineering implementation, verified automated behavior and explicit publication/integration dependencies.
