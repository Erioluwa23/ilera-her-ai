# ÌleraHer — UI/UX implementation handoff

Design version 1.0 · 10 October 2026

This package redesigns the sections visible in the nine supplied screenshots. It is a design specification with a clickable prototype, not a production health application. All dates, messages, durations and records in the designs are illustrative. No account, microphone, AI service or live health record is connected.

## Deliverables and use

1. Open `IleraHer_Prototype.html` in a modern browser. Use the screen selector to review every state; use the app controls to walk the connected flows. Recording, playback and AI replies are simulated. The prototype does not request microphone access or send network requests. Draft edits exist only in memory until the page closes.
2. Use `screens/` for individual 2× PNG designs and `editable-svg/` for scalable, editable artboards. Import SVGs into Figma, Penpot or a vector editor to adjust them. This is an SVG handoff, not a native Figma `.fig` file.
3. Read this guide before implementing. Treat `design-tokens.json` as the shared visual contract. Build the production UI with semantic HTML/components; do not render these SVG screenshots as the application interface.

## What changes

The current interface uses long introductory text, repeated footers, large empty margins, handwritten body typography and several exposed destructive actions. The redesign makes daily tasks visible immediately and places detail where it is needed.

| Current section | New destination | Main improvement |
| --- | --- | --- |
| My cycle | Cycle | One period-status card, compact calendar and one-tap logging |
| Speak | Chat | Message bubbles, voice waveforms, fixed composer and transcript review |
| My logs | Logs | Scannable period timeline and contextual record actions |
| Help | Help | Four short support rows, accessible detail and honest availability |
| Feedback | Help → Share feedback | Fast rating, simple category, optional comment and confirmation |
| Low-data voice header link | Help → Low-data voice; Chat options | Simple voice view, same conversation/history |
| Admin header link | Separate authenticated admin route | Everyday navigation remains focused on users |

Keep all four navigation labels visible. Feedback is a support action, not a daily destination. Privacy/language is always reachable from the top bar. The full header and navigation must not cover content or the composer.

## Visual system

Warm plum provides the anchor; lilac gives selected states; rose marks logged period days; amber marks connection issues; green confirms a completed action. Color always has a companion label, shape or icon.

| Token | Value | Use |
| --- | --- | --- |
| Background | `#FBF8FD` | Main app surface |
| Surface | `#FFFFFF` | Cards and composer |
| Ink | `#30213F` | Headings/body |
| Muted text | `#73667F` | Supporting copy |
| Primary plum | `#573C78` | Main buttons, outgoing bubbles |
| Selected lilac | `#E9DDF6` | Active navigation and chips |
| Soft lilac | `#F3EDF9` | Secondary panels |
| Rose / berry | `#F9E4EC` / `#A34368` | Logged period days |
| Mint / green | `#E9F2EC` / `#376449` | Confirmation |
| Peach / amber | `#FAEDDF` / `#885A25` | Offline status |

Use a readable system sans serif with full support for Yorùbá, Hausa and Igbo characters. The artboards use DejaVu Sans to keep export deterministic. Use 16px body text, 14px form labels, 12px metadata, 28px page titles and 34px hero numbers. Supporting line-height is 1.5. Navigation is 12px with persistent labels. Do not use a script font for health information, dates or controls.

Spacing follows 4, 8, 12, 16, 20, 24, 32, 40 and 48px. Mobile gutters are 20px at 390px width. Cards use 20px corners, buttons 16px, pills fully rounded. Illustrations are small geometric botanical accents; they do not replace feature icons. Main controls have 48px targets; calendar targets are 44px. SVG icons use a 24px grid, a 1.8px rounded stroke and labels.

| Meaning | Icon | Visible label |
| --- | --- | --- |
| Cycle | Calendar with date marks | Cycle |
| Conversation | Speech bubble | Chat |
| Record history | Bound notebook with lines | Logs |
| Support | Question mark in circle | Help |
| Audio input | Microphone | Tap to record / Record again |
| Period flow | One, two or three droplets | Light / Medium / Heavy |
| Privacy | Lock | Privacy & language |
| Playback | Triangle / pause bars | Accessible play/pause label; duration nearby |
| Editing | Pencil | Edit log / Edit words |
| Feedback | Expressive face / heart | Share feedback |

## Screen inventory

| ID | Screen | Build behavior |
| --- | --- | --- |
| 01 | Cycle | Show current logged status, estimate if valid, month grid, daily summary |
| 02 | Chat | Thread, language, transcript access, composer and contextual options |
| 03 | Recording | Elapsed time, maximum duration, waveform, pause, discard and Review |
| 04 | Review | Listen to draft; inspect/edit transcript; Send or Record again |
| 05 | Logs | Periods, symptoms and notes tabs; summary rows; export |
| 06 | Log a period | Short date/flow/pain/symptoms form with optional note |
| 07 | Help | Low-data voice, care guidance, privacy, feedback; phone availability |
| 08 | Feedback | 1–5 rating, category and optional message |
| 09 | Low-data voice | Language, large recording target, text alternative, saved history |
| 10 | Your space | Language, storage/process disclosure, export and guarded deletion |
| 11 | Welcome | Optional language-first setup and Explore first |
| 12 | Empty cycle | Friendly invitation; no invented predictions or statistics |
| 13 | Feedback received | Short success confirmation with return actions |
| 14 | Offline chat | Preserve draft, show unsent state, offer review/manual resend |
| 15 | Voice privacy | Explain external audio processing before first recording |
| 16 | Desktop cycle | Navigation rail; calendar and daily detail in separate columns |

## Flow contracts

**First visit:** Welcome → select language → Get started → empty Cycle. Explore first goes directly to Chat. Setup requires no period dates, pregnancy status, relationship status or age. Save language preference according to the current app’s consent/storage policy. On subsequent visits restore the last destination and language. Do not replay welcome after every refresh.

**Daily logging:** Cycle → Log today → date/flow/pain/symptoms → Save → Cycle with the relevant day selected and a short “Log saved” status. Calendar day → daily detail → Edit → same form prefilled. Logs → period row → record detail → Edit. Back or close restores the prior date, month and scroll position. Warn before leaving an edited unsaved form. Failed saves keep the draft and show Retry.

**Voice conversation:** Chat → microphone → first-use voice disclosure → operating-system permission → recording → Review → transcribing → editable transcript → Send → answering → reply. Pause/resume stays in the same recording. Review is the explicit step that uploads audio for transcription after the initial disclosure. Sending text is a separate consented action. Discard removes the draft. Send is never triggered by releasing the microphone or by silence. If transcription fails, keep audio and offer Retry, Record again and Type instead. If answering fails, preserve the confirmed question and offer Retry without repeating the upload. Clamp recordings to the currently supported maximum; the designs show the existing 60-second limit.

**Feedback:** Help → Share feedback → choose rating/category → optional note → Send → received → Cycle or Chat. Show the received screen only after the backend acknowledges receipt. A failed request keeps input, shows one concise error and a Retry action. The design prototype skips the server and demonstrates the destination.

**Low bandwidth/offline:** Help or Chat menu → Low-data voice → same conversation. Never start a separate unconnected history. While offline, stored audio can play only if locally available; do not promise playback for uncached recordings. A new answer still needs internet. Keep an unsent draft, label it clearly and ask the user to tap Send after reconnection. Never automatically upload a private draft. Text is the available alternative when audio upload or synthesis is unavailable.

## Per-section implementation detail

### Cycle

The hero uses logged facts for its main number. “Day 6” in the example follows the synthetic 5 October start; it is not derived from the uploaded screenshots. “31 Oct · estimate” is sample presentation only. Retain the app’s validated prediction engine and its data requirements. Never use the artboard numbers as fallback data or compute a clinical conclusion in the UI layer. A valid prediction is labelled as an estimate and has an explanatory info action. If confidence/data is insufficient, show “Still learning” and a logging action instead of a date. Never label a fertility estimate as a “safe day” or imply contraception reliability.

Each calendar cell’s accessible name includes the full date and its state: logged, estimated, selected/today, or no log. Logged days use a solid rose fill; predictions use a dashed outline; today has a solid border and accessible current-date state. The legend matches the displayed colors and patterns. Month arrows are 44px controls. Date taps do not change recorded data. Today returns to the current date. Preserve the selected date while viewing detail; distinguish selected from today.

At 320px width use a near-full-width calendar with narrow gutters and a 44px seven-column grid. Reflow surrounding cards instead of shrinking all touch targets. At 200% text size move summaries below the grid and let copy wrap. Do not force the entire screen into one fixed-height viewport in production.

### Logs and logging

Use one period episode with daily entries rather than treating every daily date as a new cycle. Timeline rows show the actual date range/ongoing state, logged duration, latest flow and symptom summary. Tap the row for detail; use an overflow menu for Edit, Export and Delete. Destructive controls must not sit beside every row as the most prominent action.

Validate start date required; reject future dates for actual historical logs; end is optional for an ongoing period and must not precede start. Prevent accidental duplicate/overlapping episodes and guide users to update an existing record. Do not silently replace history. Flow is a labelled single-select group with droplet pictograms. Pain uses an accessible integer 0–10 slider plus keyboard/number control; “None” and “Worst” anchor it. Symptoms are toggle chips with pressed state and an optional More sheet. Notes remain optional. Follow the backend’s actual record schema and aggregation rules.

Individual deletion names the specific record and uses a confirmation dialog. A short Undo window may precede committing the deletion, or retain a reversible tombstone if supported. Do not claim Undo after irreversible removal. Delete all lives in Your space and must explain that logs/conversations/audio are separate datasets where that is true. Export uses the app’s supported format; clearly warn that the downloaded copy can contain private records.

### Chat and audio

Use familiar left incoming/right outgoing bubbles, rounded corners, duration and subtle timestamps. Keep the AI identity explicit. Do not show a human “online” indicator or unverified response-time promise. Waveforms visualize stored samples where available. Never render a fake progress bar as live recording feedback in production. Keep only one audio player active. Display pause, elapsed/total time and accessible seek controls. Add playback speed (1×, 1.5×, 2×) in the contextual player controls when supported; preserve position when pausing. Audio never autoplays.

The composer is pinned above the navigation safe area; the thread occupies the space between header and composer and scrolls independently. On keyboard opening, use the visual viewport/insets to keep the composer reachable and preserve the message position; temporarily collapse the tab bar if necessary. Do not scroll users away from a message they are reading when a reply arrives; show a “New reply” affordance. Provide a clearly labelled text input alongside microphone input.

Transcript controls expand directly below a message. The draft transcript is editable before Send. Assistant text is readable without playing audio. Responses should use a short first answer and a small number of optional expandable details: next steps, when to seek care, sources. Preserve the existing clinician-reviewed safety/escalation logic. A concerning response must show actionable care guidance immediately, outside a collapsed detail. Do not reduce necessary medical safety content merely to meet a text budget.

Language is visible in the chat header and can be changed without deleting history. Each message retains its original language. Conversation history opens from the clock/history control with New conversation, search/list, rename if supported, and Delete. Message overflow provides Reply, Copy transcript, Download and Share only where supported; before external sharing, show a private-content preview and an explicit user action. Do not claim WhatsApp-like end-to-end encryption: the app sends audio and confirmed text to services.

### Help and feedback

Help presents four concise rows with icons and one-line descriptions. Put long phone-service setup details in an expandable sheet. Until a verified service is available, show a Coming soon label and no tappable call number. Care guidance uses existing reviewed content and verified contact information only. General emergency guidance must not pretend that the AI/phone service provides emergency care.

Feedback uses five faces that range from sad to delighted, with visible numbers 1–5 and screen-reader labels “1 of 5, Poor” through “5 of 5, Excellent.” No selection by default in production; the artboard illustrates a selected 5. Category is a single-select group: Problem, Idea, Loved it; use a neutral default if skipped. Comment is optional and capped by the actual API limit. Rating-only feedback should be supported if the API allows it; otherwise align the UI and guide with the real required fields. Do not preselect a positive rating. Keep health questions directed toward Chat and private medical details out of feedback.

### Privacy and language

One short summary is always accessible: records are in this browser; clearing site data removes them; shared devices may expose them; audio and confirmed text are processed externally. Expand to the actual current retention, provider, deletion, export and storage details. Never call browser storage encrypted unless independently verified. A lock symbol here means privacy controls, not a security guarantee. Respect existing consent choices and do not migrate local records to an account silently.

Translate the complete UI, error states, accessibility labels, placeholders and health responses for Nigerian English, Yorùbá, Hausa and Igbo. Use a single i18n key catalogue. Validate human-reviewed strings and diacritics; allow longer labels to wrap. Audio language and UI language can follow one preference by default with a per-message override if needed. Confirm the actual language/model capability from the repository; this redesign does not change providers, including required N-ATLAS integration.

## Responsive component plan

Implement `AppShell`, `TopBar`, `PrimaryNav`, `StatusCard`, `CalendarGrid`, `DailyLogSummary`, `PeriodTimeline`, `PeriodLogForm`, `ChatThread`, `VoiceBubble`, `ChatComposer`, `RecorderPanel`, `TranscriptReview`, `ConversationDrawer`, `SupportList`, `FeedbackForm`, `PrivacyPanel`, `Dialog` and `Toast`.

Below 768px use a single column and four bottom destinations. At 768–1023px use a compact navigation rail where space allows and two columns for calendar/daily detail. At 1024px+ use a 230–248px sidebar with content width capped near 1120px. Desktop chat becomes history rail + readable thread, with optional contextual care detail; do not stretch messages across the full display. Log/edit/review sheets become centered dialogs on wide screens. Use real CSS reflow, not scaling artboard images. Honor `env(safe-area-inset-bottom)` and dynamic viewport height; avoid hiding the final row behind fixed navigation.

Route suggestions: `/cycle`, `/chat/:conversationId?`, `/logs`, `/logs/:recordId`, `/log/new`, `/help`, `/help/feedback`, `/voice-lite`, `/settings/privacy`. Onboarding and first-use consent can be route-preserving dialogs. Wire browser Back, deep links and reloads; retain module drafts and restore prior context. Future pregnancy, conception and baby-growth modes can plug into a mode selector in Cycle once implemented and clinically reviewed. Do not show inactive future features as functioning choices now.

## Micro-interactions and required states

Use 160–200ms transitions, pressed states and a thin visible focus ring. Respect reduced motion. No bouncing, pulsing health warnings or automatic celebratory audio. Toasts are brief, accessible and never the only place to explain an error. Prefer inline validation and status messages close to the affected action.

| Component | Required states and recovery |
| --- | --- |
| Cycle | empty / learning / valid estimate / selected day / no log / offline stored data |
| Save log | idle / edited / saving / saved / validation error / failed save with preserved draft |
| Recorder | permission needed / denied / unavailable / recording / paused / duration limit / discarded |
| Transcription | processing / editable transcript / retry / no speech / unsupported language |
| AI reply | sending / answering / ready / unavailable / care escalation / retry |
| Audio player | not downloaded / loading / playing / paused / unavailable; transcript remains available |
| Feedback | untouched / selected / submitting / received / failed with preserved draft |
| Records | populated / empty / individual delete confirmation / delete-all confirmation / export |

For permission denied: “Microphone is off. You can type instead.” Provide an explicit text alternative and concise permission help. For transcription failure: “We couldn’t read the audio. Try again or type.” For a failed response: “No reply yet. Your message is saved.” Use “Saved” only after actual local persistence succeeds; otherwise say “Your draft is still here.” Never make success/privacy/connection claims just because the design expects them.

## Coding-agent execution order

1. Read the repository’s agent instructions/checkpoint and inspect routes, schemas, current models, local persistence, consent and safety logic. Map the visual controls to existing capabilities. Do not change services as part of the redesign.
2. Implement tokens, icon primitives and responsive shell. Remove repeated marketing footers from task screens. Keep required safety information available in context.
3. Implement cycle/calendar and log/timeline flows while retaining existing user data. Introduce safe schema migration only where necessary.
4. Implement chat layout, composer, recording/review/transcript and contextual actions. Connect the existing ASR/LLM/speech adapters; preserve state across network failures.
5. Implement Help, low-data view, feedback, settings and first-use flows. Keep unsupported phone features clearly unavailable.
6. Verify full flows and capture screenshots at 320, 390, 768 and 1280px. Check reduced motion, 200% text, keyboard-only navigation and all four languages. Update the project checkpoint with actual changes/tests/errors. Do not claim a feature is working based on a screenshot alone.

Acceptance: first logging is reachable from Cycle in one tap; first voice recording needs only the necessary consent/permission steps; review can edit the question before Send; every reply has a text path; a failed request loses no draft; four primary destinations remain labelled; no content is obscured by navigation/keyboard; deleting history needs a clear intentional action; estimates/coming-soon states are honest; current health-safety behaviors remain reachable.

## References and verification limits

Design inspiration: [Meta/WhatsApp voice messages](https://about.fb.com/news/2022/03/new-voice-message-features-on-whatsapp/) — pause/resume, waveform and draft preview; [Google navigation bars](https://developer.android.com/develop/ui/compose/components/navigation-bar) — consistent compact navigation; [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) — 44px target goal. These informed interaction choices, not a claim that ÌleraHer is affiliated with those products or fully accessibility-certified.

The SVG/PNG designs and PDF were rendered and visually inspected. Prototype script syntax, SVG structure, route targets and core text contrast were checked. An interactive browser run was unavailable in this environment; recording, API calls, localization, responsive production behavior and accessibility must be verified in the real application. No production repository or deployment was changed.
