# Saved voice conversations

The `/voice` and `/lite` screens now use the same saved voice chat. Input remains voice-only: no typed health questions or free-text composer.

## Implemented experience

- Each recording becomes a message with an audio player. It remains available if transcription fails, with a retry action.
- Users review the transcript before sending for guidance. There is no editable text input.
- Messages, audio blobs, replies, source links, care priority, timestamps and reply relationships are saved in IndexedDB in the current browser/device. Refreshing or moving between voice and lite screens restores them.
- A voice follow-up references a specific message. Only up to eight ancestors from that branch are sent as conversation context; other conversations and sibling branches are excluded. A new question sends no prior context.
- The N-ATLAS generation request receives the selected dialogue and source-grounded facts. Curated guidance remains the existing fallback when generation is unavailable. Earlier urgent symptoms and newly reported danger signs retain urgent care guidance. Dialogue is not treated as medical evidence.
- A conversation picker, new-conversation button and confirmed deletion manage multiple conversations. Deleted conversations are removed from this device; previously downloaded/shared files are unaffected.
- Users can share an individual audio file through the device share sheet where supported, or download and attach it themselves. Replies without generated audio export as text, labelled Download reply. Sharing requires an explicit action and notice.
- Native audio controls provide replay, pause, seeking, volume and download. Playing one message pauses other messages.

## Persistence limits

Storage is local to the site's origin and browser profile. There is no account sync, cloud backup or public share link. Clearing site data, private browsing or browser eviction can remove messages. IndexedDB is not an encrypted vault and anyone with access to that browser profile can read its messages. The UI makes device storage and external processing visible. Audio is not automatically uploaded for storage; it is transmitted to the existing ASR service for transcription. Confirmed text and the selected dialogue are sent to the existing answer service.

The store refuses new writes above 50 MiB of audio or 300 messages. It does not silently remove old messages. When writes fail, a visible notice tells users to download their recording and free storage; the message remains usable in the open tab. A deleted conversation frees space. Browser-supported downloads are the portable backup.

## Reply audio

Tapping the assistant's **Listen to reply** player calls `POST /api/voice/audio`,
which uses `saheedniyi/YarnGPT2b` in `Kolade1/ileraHer-natlas-runtime`. The
response includes the care disclaimer. The client verifies the model and language
headers before saving the WAV blob and its `audioModel` provenance in IndexedDB.
The same player starts playback, supports pause/seek/speed, and reuses that saved
blob on replay without another synthesis request. If the browser blocks playback
after an asynchronous request, the generated audio remains available for another
explicit tap. Assistant audio from older versions without model provenance is
regenerated on listening; the old file remains downloadable until replaced.

The runtime selects these speakers:

| Language | UI code | YarnGPT speaker |
|---|---|---|
| English | en-NG | idera |
| Yoruba | yo | yoruba_female2 |
| Igbo | ig | igbo_female2 |
| Hausa | ha | hausa_female2 |

There is no browser/device speech synthesis or alternate `VOICE_TTS_*` provider
override. Quota failures return HTTP 429 and a translated retry notice; other
speech failures preserve the text reply. Never replace an unavailable YarnGPT
voice with a different speaker. ASR and answer-generation providers are unchanged.

When Hugging Face includes a retry delay in the quota error, the API preserves
it as an absolute `retryAt` UTC timestamp plus `retryAfterSeconds` and the
`Retry-After` header. Chat, transcription and cycle-insight error notices display
the supplied deadline in Nigeria time (WAT), with a date to disambiguate the next
day. If that delay is absent, the backend reads the same authenticated caller's
reset timestamp from `GET https://huggingface.co/api/spaces/zero-gpu/quota`.
GPU-time and execution-count limits can reset separately; when both block a call,
the later reset is used. Unrelated rate limits and Space-wide caps do not use an
account's daily reset. The lookup is bounded to four seconds and keeps the original
429 error if unavailable. Fine-grained `HF_TOKEN` credentials need the Hugging Face
permission **Billing > Read billing usage and payment method status** for this
read-only endpoint. Missing permissions, null or invalid reset data never become
an invented time; no token or billing payload is forwarded to the UI.

Cycle insights also use YarnGPT on an explicit Listen action. The interface states
that listening sends the displayed summary text to the speech service. It does not
send full period records or use an LLM. Insight audio is cached only in memory.
Saved chat WAV files can replay offline; generating new speech needs connectivity
and available Hugging Face compute quota. Responses are private/no-store and audio
is capped at 4 MiB. No extra paid infrastructure is configured.

## Verification

Run `npm test` and `npm run build`. The automated tests cover branch isolation, bounded context, urgent follow-ups, rejection of system-role injection and speech-output configuration/security. Browser checks use synthetic microphone audio and mocked ASR, answer and TTS responses to test the chat experience independently of the current inference outage. They do not establish real multilingual inference accuracy.

Before claiming live speech is fully working, test actual recorded speech, contextual N-ATLAS responses and selected output voices in all four languages against the configured services.
