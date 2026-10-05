# Voice chat checkpoint — 2026-10-05

User scope: focus on the interactive chat experience, not ASR outage repair. Retain voice-first input and lemon/green design. Save audio, replay, follow a specific message, and share.

Implemented saved message timeline on voice and lite routes, IndexedDB blob persistence, multiple conversations, explicit delete confirmation, transcript review before sending, retry after transcription/answer failure, branch-specific contextual N-ATLAS requests, native replay, selected-message sharing/download, and optional server speech-output adapter for persistent assistant audio. No typed question field added. See VOICE_CHAT_SETUP.md for configuration and storage limits.

Validation: 123 Vitest tests pass; production build passes; targeted Next.js ESLint checks pass; git diff --check passes. Chromium browser verification passed with synthetic microphone input and mocked ASR/answer/TTS responses: failed-transcription recording survives reload, transcription retry and confirm/send work, assistant audio survives reload and plays, older-message follow-ups exclude sibling branches, new conversations have no context leakage, share fallback downloads audio, confirmed deletion survives reload, mobile has no horizontal overflow, and home navigation works. No browser page errors observed. Browser runtime installed outside repository for this verification.

Limitations: recordings are saved on this device, not synchronized or backed up to a server. Browser/site-data clearing and eviction may remove them. Saving is limited to 50 MiB audio and 300 messages and failures are visible. Native device speech synthesis replays stored response text but cannot export audio. A tested VOICE_TTS_API_URL / optional key / VOICE_TTS_LANGUAGES is required for saved/shareable assistant audio. It is not currently configured, and no TTS provider was provisioned. Existing N-ATLAS inference availability remains a separate unfinished infrastructure requirement. Browser tests do not establish actual model accuracy or multilingual speech success.

The offline cache now excludes API responses and honors no-store; obsolete application cache entries are purged on service-worker activation.

Production follow-up: voice and lite pages serve the saved chat with HTTP 200. Speech-output same-origin checks were adjusted for Render TLS termination using its server-provided RENDER_EXTERNAL_URL (not caller-controlled forwarded headers). Added a regression test for valid public-origin and rejected foreign-origin requests.

## Compact chat layout — 2026-10-05

Reduced message width to at most 440px, card spacing/padding and player height; reduced care/status blocks and action spacing while retaining replay, follow-up, share and download. Replaced language pills and the large microphone stage with a compact recording row: microphone on the left, recording status in the middle, native accessible language dropdown on the right. Narrow screens keep controls within the viewport, with a two-column fallback below 360px. Microphone uses an SVG icon rather than an emoji glyph.

Validation: production build passed. Chromium browser checks verified dropdown selection, card width/height, compact recording-row height, mobile viewport overflow, and the existing recording/reload/replay/follow-up/share/deletion flows using mocked providers. No page errors. This is a presentation update; inference services and persistence behavior are unchanged.
