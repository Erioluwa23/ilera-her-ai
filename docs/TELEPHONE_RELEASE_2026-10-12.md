# Ordinary telephone release — 12 October 2026

The telephone software is deployed; public telephone access is **not activated**.

- Source release: `6445d4a2e9a8ef1c939ae65639347d40553129d6`.
- Render deploy: `dep-db6g8inlot8c73a3mh3g`, live at 16:03:43 UTC / 17:03:43 WAT.
- GitHub CI: run `38274416299`, completed successfully, including PostgreSQL/Python call bridge, gateway tests, production build and model contracts.
- Local validation: 469 JavaScript tests passed; the optional Python bridge was skipped locally and ran in CI. Production build, TypeScript and targeted official Next.js/TypeScript lint passed.
- Post-deploy `/api/ivr/status`: HTTP 200 at 16:04:19 UTC / 17:04:19 WAT. Recent Render error logs were empty.

The implemented transport is `telephone`; status explicitly reports `callerInternetRequired=false` and `appAccountRequired=false`. Basic callers use the keypad for language and consent, speak after the beep and hear a verified YarnGPT reply in English, Yoruba, Hausa or Igbo. Guest calls do not require prior app registration. Saved history is optional.

The live readiness response confirms working database, N-ATLaS ASR/LLM and loaded YarnGPT. It also confirms missing provider credentials and owned number, absent playable control pack, disabled IVR and no real-call attestation. `ready=false`, `setupReady=false` and `phoneNumber=null` are expected. The UI therefore does not advertise an agent telephone number. The original Nigerian contact SIM is not connected to the cloud agent.

The actual public-menu preparation attempt was rejected by the speech quota until **2026-10-12T16:33:28.382Z / 17:33:28 WAT**. It stopped without generating a substitute voice; no WAV files were generated. The script can resume after the service's actual deadline. Draft scripts and checksum verification are deployed; native-language acceptance has not been performed.

Activation needs an approved carrier account/number, playable and reviewed YarnGPT control recordings, and successful ordinary-phone calls with mobile data and Wi-Fi off. Follow [IVR_SETUP.md](../IVR_SETUP.md). No number purchase, paid upgrade, recharge, forwarding or nonprofit application has been performed. Browser inspection of Twilio currently reaches an email sign-in wall; authenticated provider setup remains outstanding.

No real inbound telephone call or real-call audio quality is claimed by this release.
