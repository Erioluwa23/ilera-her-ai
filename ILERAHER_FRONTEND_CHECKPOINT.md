# ÌleraHer frontend checkpoint — 2026-10-05

## Changes

Implemented the user-selected lemon and green UX concept in the full app and Lite route. Added a responsive welcome card with a local 8.8 KB WebP illustration, mobile bottom navigation, actual cycle overview/calendar, clear empty states, save confirmation and delete-all confirmation. Updated the PWA colours. Added focus styling, a skip link and reduced-motion support. Voice answers play only when requested. User-facing copy uses plain language.

Cycle logs remain browser-only. No cloud sync is claimed. Predictions are estimates based on saved starts, with no invented bleeding duration. IVR is labelled coming soon with no invented support number. Existing AI and telephony provider code is unchanged; live inference and calls were not verified by this frontend work.

## Validation

- All 75 existing Vitest tests passed.
- Production Next.js build passed after final component changes.
- Four existing Python lifecycle tests passed.
- Changed frontend files passed the installed Next.js ESLint rules through a temporary config. The pre-existing npm run lint script has no ESLint configuration; no unrelated migration was added.
- git diff --check passed.
- Browser visual and interaction checks could not run: browser installation failed on certificate trust, and an alternate download returned truncated/non-ZIP content twice. No screenshot verification or live deployment validation is claimed.

## Follow-up

Verify the deployed full and Lite routes at mobile and desktop sizes, period persistence and voice interactions once a browser is available. Backend service readiness remains a separate task.

## 2026-10-05: multi-page, voice-first interaction

- Separate screens: language welcome (/), cycle overview (/cycle), tap-based period logging (/log), voice guidance (/voice), saved history (/history), access/help (/help), lightweight voice (/lite).
- Shared navigation highlights the current route. Language preference carries between welcome and voice screens. Existing browser period records and legacy records remain readable.
- Calendar supports previous/next month, Today, date selection, recorded-duration highlights and selected-date links to logging. Logging supports flow/symptom taps, pain slider, saved-record editing and deletion with confirmation. Typed question and free-text note inputs were removed. Existing notes are preserved.
- Voice journey: record, stop, replay original audio, review read-only transcript, confirm to request guidance, record again, cancel, retry, and listen/pause/resume/stop answer playback. Language is frozen for a recording/request; microphone tracks and requests are cleaned up when leaving the screen. Lite reuses the same voice-only component.
- Read-only transcript and answer text remain as confirmation/accessibility output; there is no typed-question mode. Playback uses matching device voices and reports unavailable languages without claiming synthetic audio success. IVR remains a coming-soon screen with no fabricated number.
- All 81 tests pass, including six new calendar edge-case tests. Production build passes all seven screens. Targeted Next.js ESLint checks pass. Browser interaction verification is scheduled after deployment; live ASR readiness is checked separately and is not established by these frontend tests.
