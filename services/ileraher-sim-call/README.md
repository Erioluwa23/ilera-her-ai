# ÌleraHer SIM Call Pilot

This is an independently runnable call service. It connects a dedicated SIM's
voice-capable GSM/LTE-to-SIP gateway to Asterisk, and calls the existing ÌleraHer
application through authenticated HTTP APIs. It has no Twilio dependency or HF
credential. The application retains ownership of registered users, PINs, AI
providers, health guidance and feedback. Keep one worker and one active call for
this single-SIM pilot.

## What is implemented

1. A signed-in user opens **Help → Calling PIN & replies** (`/settings/phone`).
   Their existing account password is required to create/reset a six-digit calling
   PIN, choose optional 30-day saved replies, or disable calling and delete replies.
2. They call the dedicated SIM number from their registered phone. The gateway
   forwards the original caller ID to extension 7000. Unknown/withheld caller ID
   is rejected. Caller ID alone never authenticates an account.
3. Asterisk answers, offers only installed/reviewed prompt languages, obtains
   recording consent and collects the PIN with DTMF. Three tries are allowed per
   call; five failed PIN checks across calls lock the account for 15 minutes.
4. The caller records up to 30 seconds and presses 1 to submit (2 re-records).
   No question audio is sent to AI before consent and PIN verification.
5. The app uses its existing N-ATLAS ASR, the same source-grounded health-answer
   logic as web chat, N-ATLAS generation when available, and its existing
   YarnGPT2b/configured speech output. Curated answers remain explicitly labelled.
   Earlier urgent symptoms cannot be downgraded by generation. The service does
   not introduce another ASR or text model.
6. FFmpeg converts spoken output to mono 8 kHz PCM WAV for Asterisk. A successful
   playback acknowledgement is required before a reply is saved. The caller can
   repeat the audio, ask a follow-up, rate 1–5, or finish. Ratings use the app's
   existing feedback table and appear in its admin dashboard.
7. Calls expire after 15 minutes, allow six submitted questions and up to twelve
   recording attempts, and clean local audio on hangup/error/restart. In-call
   dialogue is encrypted and cleared on close; unanswered expired contexts are
   deleted during maintenance. Optional played replies are encrypted, account
   scoped and expire after 30 days. No raw audio/PIN/transcript is logged.

**Current phone limitation:** this service does not read period records (earlier
browser records or the newer account-stored cycle records) or web chat history.
It does not predict from those records. Follow-up context is limited to this call.

## Components and deployment

| Component | Location | Role |
|---|---|---|
| Registered-user adapter | Existing Next.js app on Render | Accounts, hashed PINs, short-lived call grants, encrypted context/replies, shared AI, feedback |
| Independent API | `simcall/api.py` on Linux call host | Call lifecycle, one-line capacity, authentication forwarding, audio and rating API |
| FastAGI controller | `simcall/fastagi.py`, TCP 4573 on loopback | DTMF, recording, playback, waiting music, repeat, hangup cleanup |
| Asterisk | Same Linux host | SIP/RTP termination and call controls |
| SIM gateway | Local LAN or private VPN | Carrier voice call ↔ SIP conversion |

Use a powered Linux machine on the gateway's LAN, or a VM connected to that LAN
over a private VPN. The call host needs stable internet to reach Render and the
app's model runtime. The caller needs ordinary voice service, not mobile data.
SIP/RTP is not an HTTP web service: the existing Render web app hosts the adapter,
while Asterisk belongs on the call host. Dockerfile provides API-only packaging;
native systemd installation is the full pilot deployment.

## Native setup on a dedicated Ubuntu 24.04+ machine

Confirm the gateway supports voice calls on the selected operator/network, passes
original caller ID, sends RFC2833/RFC4733 DTMF and supports G.711 alaw/ulaw. Confirm
the operator permits this business use of the SIM. A data-only router is insufficient.
The gateway is the hardware needed to connect this software to a real phone number.

```bash
cd services/ileraher-sim-call
sudo env SIM_GATEWAY_IP=192.168.1.50 bash install.sh
sudoedit /etc/ileraher-sim-call.env
```

Generate two separate random secrets using a secure host tool. Configure:

- `PHONE_INTEGRATION_KEY`: same value on this host and in the existing Render app.
- `SIM_API_KEY`: different value, used only by the local API/FastAGI controller.
- `ILERAHER_APP_URL`: existing app origin, without a path or credentials.
- `SIM_REVIEWED_LANGUAGES`: `en-NG` initially. Add `yo,ha,ig` after acceptance.

Do not put credentials in chat, source control, URLs or `NEXT_PUBLIC_*` variables.
The service key also protects encrypted reply data: keep it stable. Rotation needs
an intentional deletion/re-encryption of existing phone replies and sessions.

Configure the gateway's Mobile-to-SIP route to `7000@<Asterisk-LAN-or-VPN-IP>:5060`
and forward original caller ID. These templates use a fixed IP-restricted peer;
gateway registration is not required. Disable gateway SIP-to-Mobile/outbound
routes. Check the real vendor's setting names; a normal SIP user/password setup
differs from this fixed-peer configuration.

Review installed Asterisk transport settings before starting: this pilot's UDP
transport must not compete with another transport on port 5060. The installer adds
isolated includes to pjsip/extensions, preserving existing files. Configure RTP
ports using `asterisk/rtp.conf.example`. Disable AGI debug, verbose call tracing,
CDR/CEL and automatic call recording for this dedicated pilot; consult
`asterisk/logger.conf.example`. Exposing an unfiltered SIP port is unnecessary.
Allow UDP 5060 and the chosen RTP range **only from the gateway's LAN/VPN address**.
Keep API 8078 and FastAGI 4573 on loopback. The dedicated host should use the same
`asterisk` group for audio-file access, as the unit/installer provide.

```bash
sudo systemctl restart asterisk
sudo systemctl enable --now ileraher-sim-call
curl http://127.0.0.1:8078/healthz
sudo asterisk -rx 'pjsip show contacts'
```

The service sends a status heartbeat every 30 seconds based on the actual Asterisk
`sim-gateway` contact being `Avail` and prompt files existing. The app never
displays a callable number based on software liveness alone.

In the existing app's server environment, configure:

```dotenv
PHONE_INTEGRATION_KEY=<securely configured secret shared with the call host>
SIM_PHONE_NUMBER=<actual SIM number in E.164 form>
SIM_PHONE_ENABLED=true
SIM_PHONE_VERIFIED=false
```

`SIM_PHONE_ENABLED=true` permits controlled operator acceptance calls.
`SIM_PHONE_VERIFIED` stays false until a real inbound call succeeds. Set it true
after acceptance; the Help call button additionally requires a recent gateway
heartbeat, installed languages and live ASR/speech readiness. Never publish a
sample number or claim that `/healthz` verifies carrier connectivity.

## Language prompts and speech

English control prompts can be prepared offline with eSpeak. It is used for fixed
menus only; spoken health replies still use the existing app's speech provider.
`prompts.json` contains draft control scripts for all four languages. Native-speaker
review is still required. To prepare reviewed recordings:

```bash
python prepare_prompts.py --output /opt/ileraher/prompts \
  --languages en-NG,yo,ha,ig --recordings /path/to/reviewed-recordings
```

Each language requires the eleven `<language>/<name>.wav` files listed in
`simcall/fastagi.py`. A menu is generated advertising only those selected languages.
The preparation tool refuses to substitute an English voice for Yoruba/Hausa/Igbo.
Test pronunciation, medical meaning, actual narrowband ASR accuracy and response
latency before adding a language to `SIM_REVIEWED_LANGUAGES`.

The app's existing free GPU runtime can be quota limited and slow. Phone inference
has bounded budgets: ASR 45 seconds, optional generation 12 seconds, speech 45
seconds. Quota/timeout failures play an offline error prompt and end the call;
they never masquerade as a successful reply. For consistent public phone service,
measure concurrency/latency and provision sufficient existing-model capacity.

## API contract

See [API.md](../../docs/sim-call/API.md). The app adapter requires its service key;
the call API requires its separate local key. Browser callers cannot use a PIN to
obtain an app login cookie. Neither API accepts model/provider URLs from callers.

## Verification and acceptance

Tests require FFmpeg on PATH, as provided by the native installer and CI setup.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
cd ../..
SIM_TEST_PYTHON="$(pwd)/services/ileraher-sim-call/.venv/bin/python" npm test
npm run build
```

For `SIM_TEST_PYTHON`, use an **absolute path** if invoking the cross-runtime test,
because its working directory is the service directory. CI uses `python` on PATH.
Tests cover actual PostgreSQL SQL using PGlite, the app routes, Python API and
FFmpeg conversion. ASR/generation/speech tests use explicit doubles and generated
audio fixtures: no accuracy or real phone-call success is inferred from them.

Run the physical acceptance matrix in [ACCEPTANCE.md](../../docs/sim-call/ACCEPTANCE.md)
before marking the SIM verified. No hardware is bought, number provisioned, new
paid hosting started or native-language acceptance implied by installing this code.

Retention cleanup runs on gateway heartbeats and account access. If the gateway
is offline, expiry immediately prevents access; physical deletion occurs on the
next cleanup. For unconditional cleanup while it is offline, call the authenticated
app event API with `{"event":"maintenance"}` from your existing scheduler.

## References

- [Asterisk AGI commands](https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/AGI_Commands/)
- [Asterisk PJSIP configuration](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/PJSIP-Configuration-Sections-and-Relationships/)
- [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)
