# In-app voice calls

The free calling experience is available at `/call`, reached from Help →
**Call ÌleraHer AI** or Calling settings. It uses the existing Render application
and Hugging Face runtime. It does not provision a telephone number, connect the
dedicated SIM, or incur telephone-number rental/per-minute provider charges.
Callers need an internet connection and available model compute quota.

## Provider decision

Africa's Talking's older general sandbox guide lists virtual voice numbers, but
its current voice-specific guide (13 February 2026) explicitly says the voice
sandbox is not operational. It instead directs developers to request a live test
number; it does not promise free ongoing use:
https://help.africastalking.com/en/articles/11532610-voice-sandbox

The user authorized a free simulated calling experience and requested that
"sandbox" not appear in the interface. The implemented transport therefore runs
inside ÌleraHer. The interface calls it **Voice call**, explains internet use,
and displays **Powered by N-ATLaS**. Africa's Talking integration is not activated.
The existing `+234 806 567 8634` remains a contact number in Help/settings; the
primary AI calling action opens `/call`. Ordinary calls to that SIM remain a
separate gateway/carrier activation task.

## Call flow

1. Sign in with the existing ÌleraHer account. Select English, Yoruba, Hausa or
   Igbo, agree to voice processing, and tap **Start call**. No additional calling
   PIN is needed for an authenticated app call.
2. The browser requests microphone access and creates an account-bound call.
3. Speak for up to 30 seconds. A pause after detected speech submits the question
   automatically. **Answer now** submits it explicitly. Silence alone pauses the
   microphone without submitting an empty recording.
4. Browser audio is decoded and converted to bounded mono 16 kHz PCM WAV.
   The API validates its actual codec, sample rate, size and duration.
5. The existing language-specific N-ATLaS ASR transcribes it. The shared
   `voiceAnswer` path supplies source-grounded guidance and N-ATLaS text
   generation, preserving reviewed urgent guidance and the established curated
   fallback. Curated replies are identified as reviewed guidance.
6. YarnGPT2b synthesizes the spoken answer, next steps and care disclaimer using
   the existing language/speaker mappings. The browser checks the actual speech
   model, ASR model, language, turn ID and WAV signature before playback.
7. After playback acknowledgment, the agent listens for the next question.
   Calls allow six questions and expire after 15 minutes. Mute, hang-up,
   navigation and hiding the page stop the microphone. If mobile autoplay is
   blocked, **Listen to reply** plays the already-generated audio without new
   inference.

## API and storage

- `POST /api/phone/call`: requires signed-in cookie, same-origin request, language
  and consent. Returns a short-lived random grant kept only in browser memory.
- `POST /api/phone/call/turn`: bounded multipart WAV; requires signed-in owner and
  the matching app-call grant. Duplicate/busy turns are rejected. Context is
  loaded from the server-owned call, not supplied by the browser.
- `POST /api/phone/call/event`: accepts played, feedback or end. Integration
  heartbeat and maintenance events are unavailable through this user API.

App calls reuse `phone_sessions` with an additive `channel='app'` migration.
SIM sessions default to `channel='sim'` and retain their integration-key,
enrollment and calling-PIN requirements. App-call grants cannot authorize another
account's calls or SIM sessions. One new app call closes that user's prior app
call. Health context/replies are encrypted with the existing phone storage key;
grants are stored as hashes. Raw caller audio and generated WAVs are not written
to the application database or browser storage.

Reply saving follows the existing optional account setting. A reply is saved only
after the browser acknowledges completed playback. Without that preference,
replies stay within the temporary call. Hang-up clears context and the temporary
reply; expired sessions/replies use the existing cleanup and retention rules.
Calling does not read period records or unrelated saved chat conversations.

## Configuration and errors

Existing `AUTH_SECRET`, `DATABASE_URL` and `PHONE_INTEGRATION_KEY` are required,
plus the existing Hugging Face model access. No new provider account, secret,
hardware or paid service is created. SIM activation flags are not needed for app
calls. Keep `PHONE_INTEGRATION_KEY` stable because it also protects encrypted
phone data.

ASR and TTS compute failures return HTTP 429 with `retryAt`,
`retryAfterSeconds` and `Retry-After` when Hugging Face reports the deadline.
The UI displays it in WAT. If synthesis fails after answering, the readable reply
is preserved without claiming a successful spoken response or saving it as
played. No browser speech synthesis or alternative ASR/TTS model is used.
The API responses are private/no-store and the service worker never caches them.

## Verification

The app/API/database tests cover sign-in, consent, user isolation, encrypted
context, four-language model routing, follow-ups, quota deadlines, optional saving,
duplicate/busy turns, invalid audio and hang-up during inference. Browser-media
fixtures exercise automatic turn-taking, mute, cancellation, late responses,
mobile autoplay, playback acknowledgment and expiration. They validate the call
transport and model contracts; they do not establish real multilingual speech
accuracy or pronunciation. Production inference remains subject to actual
Hugging Face quota and service availability.

Production release `27a913e742eb3cb32749525dd13a28e6be4aad79` is deployed on the
original Render service; CI `38267825357` passed, including the Python gateway and
cross-runtime bridge. Authenticated call startup/hang-up succeeded on 12 October
2026. The actual synthetic English recording returned `ASR_QUOTA` with retry time
**12 October, 17:33:29 WAT**. That verifies production quota transport, not a
successful spoken reply. Live speech acceptance remains pending provider quota.
