# SIM Call Integration API v1

The standalone service is `services/ileraher-sim-call`. It is separately deployable
from the application; the current repository keeps both contracts and tests together.
Use HTTPS for any API accessed beyond loopback. The reference full deployment keeps
the call API/FastAGI local to Asterisk and reaches the app over HTTPS.

## Standalone call API

Every endpoint except process-liveness `GET /healthz` requires
`Authorization: Bearer <SIM_API_KEY>`. Responses are `private, no-store`.
There are no anonymous incoming-call or question endpoints. The SIP gateway is
trusted only to carry calls; PIN validation remains with the registered-user app.

| Method and path | Request | Result |
|---|---|---|
| `POST /v1/calls` | JSON `{caller: "+234…"}` | `201 {callId, languages, maxTurns}`; rejects unknown/withheld caller format and occupied single line |
| `POST /v1/calls/{callId}/authenticate` | JSON `{pin: "<six digits>", language: "en-NG", consented: true}` | `{ok, language}` after app registration/PIN check; grant never returned to the calling client |
| `POST /v1/calls/{callId}/turns` | multipart `audio`: mono PCM WAV, 8/16 kHz, 16 bit, ≤30 seconds and ≤500,000 bytes | `{turnId, answer, nextSteps, disclaimer, sources, urgency, model, language, spokenText, transcriptionModel, speechModel, contentType, audio}` |
| `POST /v1/calls/{callId}/played` | JSON `{turnId}` | `{ok:true}`; acknowledges completed playback; repeats are idempotent in the app |
| `POST /v1/calls/{callId}/feedback` | JSON `{rating: 1…5}` | `{ok:true}`; requires a played reply; one durable rating per call |
| `DELETE /v1/calls/{callId}` | No body | `{ok:true}`; cancels work, closes app grant, releases capacity |

`audio` in a reply is base64 of the specified audio content type, not a public URL.
The reference controller converts it with FFmpeg and retains the last audio only
for repeat playback during this call. Never expose the service key in the web app
or put audio/PIN/grants into application logs. Each submitted question has a fresh
turn UUID. Transient failures do not auto-repeat inference.

Expected failures: `400` invalid input/consent/rating; `401` unauthenticated,
incorrect PIN, expired/revoked call; `409` occupied line, in-flight/duplicate turn,
question limit; `413` body limit; `429` upstream quota; `502/503/504` unavailable
upstream or timeout. Validation errors do not echo PINs. A liveness response does
not assert that a SIM call or speech model works.

## Existing app adapter

Server-to-server routes require `Authorization: Bearer <PHONE_INTEGRATION_KEY>`.
This key is distinct from `SIM_API_KEY` and `AUTH_SECRET`. It also derives the
encryption key for phone contexts/replies. Do not rotate it without a data plan.

| Method and path | Request | Result |
|---|---|---|
| `POST /api/phone/integration/authenticate` | JSON `{callId: "<UUIDv4>", phone: "+234…", pin: "<six digits>", language, consented:true}` | `{grant, callId, language, expiresAt, maxTurns}`; checks existing user plus calling enrolment; no web cookie |
| `POST /api/phone/integration/turn` | multipart `callId`, `grant`, `turnId`, `audio` | Spoken reply contract above; uses grant-bound language and encrypted server-held call context |
| `POST /api/phone/integration/event` | JSON `{event:"played",callId,grant,turnId}` | Saves only opted-in, acknowledged replies |
| Same | JSON `{event:"feedback",callId,grant,rating}` | Writes the existing feedback table once |
| Same | JSON `{event:"end",callId,grant}` | Clears context/reply and closes call |
| Same | JSON `{event:"heartbeat",gatewayReady,languages}` | Records latest gateway availability/prompt languages and performs retention cleanup |
| Same | JSON `{event:"maintenance"}` | Deletes expired contexts/replies; usable by an existing secure scheduler |

`SIM_PHONE_ENABLED` must be true for call authentication and inference. Cleanup and
call-ending events remain available while the pilot is paused. Call grants are
random, stored only as hashes, bound to a UUID and user, and expire in 15 minutes.
PIN reset/disabling revokes all that user's active grants. Health contexts and
saved replies use AES-256-GCM with random nonces. Audio itself is not stored by
the application adapter.

## Signed-in app UI endpoints

`GET /api/phone/account` uses the existing account cookie and returns
`{phone,enrolled,keepReplies,replies}`. PIN/hash/grants are never returned.
`POST /api/phone/account` accepts `{password,pin,keepReplies}`; `DELETE` accepts
`{password}`. Both require the account password and same-origin request. Disabling
calling deletes saved replies and active grants. Disabling saved replies also
deletes previous call replies. `GET /api/phone/status` publishes a number only
after operator verification, activation, a recent gateway heartbeat, prompts and
ASR/speech readiness. The number is never inferred from a user account number.

The UI is `/settings/phone`, reachable from Help. Saved reply text is separate
from period records and browser chat history. Period/cycle APIs are not called by
this pilot; dialogue context is limited to the current call. Ratings feed the
existing admin dashboard.
