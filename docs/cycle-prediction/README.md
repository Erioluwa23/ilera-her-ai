# Personalized Adaptive Cycle Prediction Engine

PACPE `pacpe-1.0.0` runs inside the existing Next.js server and uses the existing
PostgreSQL connection. No separate FastAPI/ML deployment, LLM provider, paid
database, or external analytics service is introduced.

## What users do

1. Open My Cycle and enable private tracking with explicit account-storage consent.
2. Optionally enter their usual cycle length and bleeding length. Neither field has
   a silently confirmed default. Choose relevant cycle context; declining this
   optional information pauses dates while period logging remains available.
3. Log or edit period starts, ends, and daily symptoms in the existing Log flow.
4. Read the API's estimate on the interactive calendar. The insight can be read
   aloud on demand using a local device voice in the selected language. No cycle
   history is sent to an LLM or cloud speech service for this feature.
5. If a gap needs review, confirm one completed cycle, mark missing logs, or correct
   dates. A missing interval resets model continuity; no intervening periods are
   invented. Earlier records stay saved.

The existing English, Yoruba, Hausa and Igbo UI catalogue covers these controls.
Native-speaker and signed-in device/visual QA are still required; automated tests
do not establish medical accuracy or human-reviewed translations.

## Statistical policy

- A completed cycle is the difference between successive period **start** dates.
- Zero completed cycles: use an explicitly reported typical length. Without it,
  request a length or another logged start. Without an anchor, request a first log.
- One/two completed cycles: smooth the observed mean with two prior observations
  at the reported length. If no reported prior exists, use the observed mean and
  label the result limited history.
- Three or more: exponential weights `0.8 ** age`. Estimate once from the history;
  do not apply a second online adjustment to the same observations.
- Calendar dates use positive half-up rounding and UTC arithmetic, avoiding DST
  and JavaScript's parsing of localized date strings.
- Weighted standard deviation of at least 7 days, or a range of at least 20 days,
  activates a robust median candidate and low-predictability treatment. These are
  engineering thresholds for testing, not clinical classifications.
- Walk-forward comparisons exclude the target interval from training. Once eight
  retrospective comparisons exist, prefer a simple historical mean when the
  weighted/robust candidate does not improve MAE. Reports distinguish cold start,
  regular-history and variable-history performance.
- The 15–90-day bounds are broad data-review checks. An unconfirmed gap over 45
  days also needs review. None of these numbers defines a medically normal cycle.
  Confirmed gaps outside the broad bounds remain unsuitable for extrapolation.
- Pregnancy, postpartum, breastfeeding, hormonal contraception, major changes, or
  unspecified context pause estimates. Users can restart with a history cutoff
  after reviewing their context. No diagnosis is inferred from these answers.
- An overdue forecast stays anchored to the actual last start. The app never rolls
  it forward over imagined periods. This feature does not estimate ovulation or
  offer a contraception guarantee.

The cycle-change safeguards are consistent with the NHS's information about
[irregular periods](https://www.nhs.uk/symptoms/irregular-periods/) and
[NHS Inform's cycle-change information](https://www.nhsinform.scot/healthy-living/womens-health/girls-and-young-women-puberty-to-around-25/periods-and-menstrual-health/irregular-periods).
Those sources do not clinically validate this algorithm or its engineering bounds.

## Windows and reliability

History count alone cannot establish forecast accuracy. The response includes
completed-cycle count and measured saved-outcome count, MAE, within-three-day
accuracy, and coverage only for predictions that actually included a window.
Observed metrics and retrospective model comparisons are separate fields.

There is **no displayed window** until at least six usable cycles and eight
prospective saved outcomes exist in the same model version and history/preference
regime. An initial empirical range then uses the larger of two days, the rounded
80th percentile of the last 20 absolute errors, and weighted variability. Variable
histories receive a minimum seven-day radius. It is explicitly an estimated range,
not a validated 80%, 90% or 95% confidence interval. Coverage must be monitored on
later outcomes before making any statistical or clinical coverage claim.

Every forecast is saved with its original calculated values, model version,
revision and database timestamp. A subsequent confirmed period evaluates the
latest eligible forecast anchored to the previous actual start. To avoid UTC/local
midnight leakage, the eligibility check conservatively adds 14 hours to the issue
timestamp and requires that resulting date to precede the actual start day.
This can exclude some otherwise eligible near-boundary forecasts; it cannot admit
a forecast made after the earliest local start day. Historical imports and
late-entered periods cannot manufacture prospective accuracy.

Historical start corrections, deletions, missing-log changes and backfills
recalculate the current prediction and supersede original forecasts for accuracy
calculations. Superseded versions remain available in the owner's export.
Reminder/bleeding-length changes do not erase already measured accuracy.

## Storage and privacy

New tables: `cycle_period_logs`, `cycle_preferences`, `cycle_predictions`, and
`cycle_prediction_evaluations`. They reference the existing account's `users.id`.
All health payloads (dates, symptoms, notes, preferences, forecasts and outcomes)
are encrypted with AES-256-GCM, fresh 12-byte nonces, full 16-byte tags, and AAD
binding the owner, record identifier and payload purpose. Plaintext database
metadata contains identifiers, revisions, timestamps, source and validity flags.

`CYCLE_DATA_ENCRYPTION_KEY` is a **server-only 32-byte base64 key**. It must remain
stable across deploys and be backed up with the database. It is independent of
`AUTH_SECRET`. Losing/replacing it makes existing encrypted records unreadable.
A deliberate key rotation requires decrypt/re-encrypt migration; there is no
automatic plaintext fallback. The server decrypts for the authenticated owner;
this is not end-to-end encryption.

All cycle routes authenticate the signed cookie. Mutations require a same-origin
request and an expected-account header, preventing an old tab from writing under
a different signed-in account. Queries are parameterized and owner-scoped.
Row locks serialize account mutations, per-record versions reject stale edits,
and record/preference/prediction writes commit as one transaction. Responses use
`private, no-store`; the service worker does not intercept cycle APIs. Error logs
contain no decrypted records, dates, phone numbers, connection strings or secrets.

Browser records are **never automatically uploaded or attached to an account**.
The manual import UI requires selection, ownership acknowledgement and storage
consent. Users can correct an old end date before importing. Imports never
overwrite existing account records, and the browser copy remains until explicitly
removed. Local drafts and calendar selection keys are account-scoped; signing out
clears cycle drafts in that tab. Drafts are browser data, not encrypted server
records, and this limitation is disclosed.

The user's export includes period records, preferences, original prediction
versions and evaluation history. Deleting account cycle data deletes all four
entities and withdraws storage consent. Earlier browser history and voice chats
have separate deletion controls. Existing SIM-call and voice integrations are
preserved; cycle records are not automatically added to phone/LLM conversations.

## API

All routes below require a signed-in account. For mutations, send
`Origin`, `Content-Type: application/json`, and `x-ileraher-account` matching the
authenticated account. The header never grants ownership. A valid
`x-ileraher-timezone` controls date-only validation; the default is Africa/Lagos.

| Route                                       | Behavior                                         |
| ------------------------------------------- | ------------------------------------------------ |
| `POST /api/v1/periods`                      | Save `{period}`; no client `user_id` is trusted  |
| `PATCH /api/v1/periods/{id}`                | Correct `{period, version}` owned by caller      |
| `DELETE /api/v1/periods/{id}`               | Delete with `{version}`                          |
| `POST /api/v1/periods/import`               | Explicit atomic import of `{periods}`            |
| `PUT /api/v1/cycles/preferences`            | Save `{preferences, revision}` with consent      |
| `GET /api/v1/cycles/prediction`             | Latest versioned estimate and honest reliability |
| `GET /api/v1/cycles/history`                | Owned logs, preferences, prediction and metrics  |
| `GET /api/v1/cycles/calendar?month=YYYY-MM` | Recorded days, start estimate, optional window   |
| `GET /api/v1/cycles/export`                 | Private export with original forecasts/outcomes  |
| `DELETE /api/v1/cycles/history`             | Erase all account cycle data and consent         |

Bodies are bounded to 32 KiB, or 1 MiB for import. Dates, overlap, daily entries,
pain, flow, annotations, text size and record count are validated on the server.

Reminders are opt-in **in-app reminders when opening the calendar**, within three
days of the estimated start. No phone, email, push delivery or background scheduler
is advertised as active.

## Verification and release limits

Release engineering checks on 10 October 2026: 337 JavaScript/TypeScript tests,
13 SIM-service Python tests, and 6 speech-runtime Python tests passed. The
production build and TypeScript checks also passed with all eight private cycle
API routes included. These checks preserve the latest SIM and speech-runtime
changes on `main`.

Tests cover explicit cold start, prior smoothing, weighted/robust estimation,
baseline selection, date boundaries, duplicate/future dates, gap review, history
resets, context pauses, empirical windows, no future-data leakage, authenticated
APIs, encryption/tampering, owner isolation, transactions, stale edits, deletion,
manual migration, API-driven calendar navigation and local-only insight playback.
Locally the database suite uses embedded PostgreSQL (the existing PGlite test
dependency); CI runs the same cycle suite against PostgreSQL 16. Test fixtures
are synthetic and are not deployed as patient data.

The public health endpoint reports only model version and storage readiness,
checking encryption configuration and schema/database connectivity. It exposes
no user history. Real pilot forecast errors, window coverage, signed-in visual QA
and native-speaker review remain separate from automated engineering verification.
