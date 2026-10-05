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

Recorded user audio is always stored as a blob when device storage succeeds. Existing device speech synthesis can replay saved reply text where the device has a voice for that language. Browser speech synthesis does **not** expose a downloadable audio file; the application does not pretend that it does.

For saved, shareable assistant audio, securely configure in Render:

- `VOICE_TTS_API_URL`: trusted HTTPS endpoint accepting POST JSON `{ "text": "...", "language": "en-NG" }` (also yo, ha, ig) and returning raw audio/mpeg or audio/wav bytes.
- `VOICE_TTS_API_KEY`: optional Bearer key, server-only.
- `VOICE_TTS_LANGUAGES`: comma-separated language codes tested with that provider, e.g. en-NG,yo,ha,ig.

This is a speech-output adapter, not an alternate ASR or LLM. N-ATLAS ASR and LLM requirements are unchanged. No external TTS provider is provisioned or selected by this change. Generated audio is limited to 4 MiB, synthesis requests time out after 20 seconds, redirects are rejected, and provider URLs are never accepted from the client. Responses are private/no-store. The reply audio includes the educational-care disclaimer. Assistant audio is saved once and reused; users can retry audio generation later with Save reply audio if unavailable initially. The configured speech service receives health response text.

Without this configuration, reply text is saved, device replay is available where supported, and the interface clearly says downloadable audio is pending. It offers text export rather than inventing an audio download.

## Verification

Run `npm test` and `npm run build`. The automated tests cover branch isolation, bounded context, urgent follow-ups, rejection of system-role injection and speech-output configuration/security. Browser checks use synthetic microphone audio and mocked ASR, answer and TTS responses to test the chat experience independently of the current inference outage. They do not establish real multilingual inference accuracy.

Before claiming live speech is fully working, test actual recorded speech, contextual N-ATLAS responses and selected output voices in all four languages against the configured services.
