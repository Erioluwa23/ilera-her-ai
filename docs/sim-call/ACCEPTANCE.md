# Physical SIM Pilot Acceptance

Current delivery implements and tests the software. A dedicated SIM gateway and
an accessible Linux host must be connected before any real incoming call can be
verified. Leave `SIM_PHONE_VERIFIED=false` until this checklist is actually passed.
Do not mark a row passed from a build, silence fixture, status heartbeat or model
metadata. Use consented, non-sensitive test phrases and existing test accounts.

## Required equipment/configuration

- Dedicated SIM with an actual E.164 number, voice service and adequate reception.
- Operator-permitted voice-capable GSM/LTE SIP gateway matching that network.
- Powered Linux call host, shared LAN/private VPN, stable internet and firewall rules.
- Server secrets configured securely on both systems, deployed app adapter and
  existing N-ATLAS/YarnGPT model runtime with usable compute/access.
- Reviewed offline prompts. Start with English; review/test each additional language.

## Acceptance matrix

| Check | Expected behavior | Actual result |
|---|---|---|
| Registered number, enrolled PIN, incoming call | SIM rings, gateway sends call to 7000, original caller ID is preserved, ÌleraHer answers | Pending physical gateway |
| Other/unregistered number | Cannot access registered-user health answers or history | Pending |
| Withheld caller ID | Safe rejection; no account is inferred | Pending |
| Wrong PIN across several calls | Three tries per call, five attempts lock account for 15 minutes; reset in app works | Pending |
| Decline consent or hang up before recording | No audio sent to AI, no saved reply | Pending |
| Record then choose re-record | Old question is overwritten/cleaned; inference has not run | Pending |
| English actual speech | Record expected/actual transcript, exact N-ATLAS checkpoint, latency, reply wording and audible playback | Pending |
| Yoruba actual speech | Same; review pronunciation/medical meaning before enabling | Pending |
| Hausa actual speech | Same; review pronunciation/medical meaning before enabling | Pending |
| Igbo actual speech | Same; review pronunciation/medical meaning before enabling | Pending |
| Follow-up question | Uses this call's earlier reports; does not read another call/user's dialogue | Pending |
| Urgent symptoms | Preserves the app's reviewed urgent-care guidance; generation cannot downgrade | Pending |
| Repeat reply | Same audio replayed; no repeated inference | Pending |
| Rate call twice | One durable rating visible in existing admin dashboard | Pending |
| Save replies enabled | Played reply appears under caller's account settings; another account cannot view it | Pending |
| Save replies disabled | No retained replies; disabling removes earlier saved call replies | Pending |
| Hang up during inference/playback | Pending work cancelled, grant closed, media removed, no false playback acknowledgement | Pending |
| Model quota/network outage | Offline error prompt, clean hangup; no fabricated answer or claimed success | Pending |
| Second simultaneous caller | SIM line busy; no cross-call session/context | Pending |
| PIN reset/disable during call | Call grant revoked; prepared result cannot be committed to saved history | Pending |
| Power restart/service restart | No old authenticated call resurrected; stale local media removed | Pending |
| 15-minute/six-question limits | Call ends safely | Pending |

Record call start/time, test case, actual behavior, checkpoint/provenance, timings
and sanitized infrastructure errors. Do not retain PINs, phone numbers or raw
health recordings as evidence. A human listening test is required to verify the
spoken reply; HTTP 200 only verifies transport.

After successful acceptance set `SIM_PHONE_VERIFIED=true`, confirm
`/api/phone/status` exposes the actual dedicated number, and test Help's `tel:`
button from a real device. If heartbeat/model readiness fails later, the button
must return to unavailable. A single SIM generally has one active call channel;
this is not a multi-caller production contact centre.
