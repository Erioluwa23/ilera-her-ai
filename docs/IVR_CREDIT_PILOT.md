# Credit-funded ordinary-phone pilot

The ordinary-phone feature is implemented using Twilio Programmable Voice. It needs a real incoming number and a provider account permitted to handle public callers and record their spoken questions. A number typed into Render or a verified personal caller ID does not allocate an incoming Twilio number. Do not purchase a number, add funds or configure auto-recharge without the project owner's budget approval.

## Nonprofit funding route

The project owner confirmed that the project is a registered nonprofit on 10 October 2026. The legal organisation name, registration country and eligibility documents still need to be provided by the owner; this document does not claim provider approval.

Twilio.org's Impact Access programme offers eligible organisations a one-time $100 product credit. Country and organisation verification apply. Its documentation says a payment method is not required to start using approved benefits, but trial accounts must complete the programme's upgrade step. Credits are finite and do not make telephone service permanently free. Confirm the actual benefits and number/call charges in the account before provisioning anything.

Apply from the Twilio account that will own the number: **Billing Overview → Nonprofit Benefits → Sign Up**, or the homepage **Get $100 credit** card when present. Select the actual country and entity type, provide the organisation's legal details and complete the requested verification. Then follow the approved programme's upgrade instructions. Do not substitute the ordinary payment-funded upgrade flow if it requests a payment the owner cannot make.

Official references, checked 10 October 2026:

- [Programme and benefits](https://www.twilio.org/en-us/support-and-resources/impact-access-program)
- [Application instructions](https://help.twilio.com/articles/8813254760603-Apply-for-the-Twilio-org-Impact-Access-Program)
- [Eligibility guidelines](https://help.twilio.com/articles/4443965939995-Impact-Access-Program-Eligibility-Guidelines)
- [Credit and payment-method rules](https://help.twilio.com/articles/360019772314-Twilio-org-Impact-Access-Pricing-Benefits)
- [Voice trial restrictions](https://www.twilio.com/docs/usage/trials/try-out-voice)

## Product description for the application

ÌleraHer AI is a voice-first health-information application for Nigerian communities. We are preparing an ordinary-phone pilot so people can access spoken guidance without a smartphone or mobile data. Callers will dial a dedicated number, consent to processing, speak their question and hear a response. The implemented journey includes replay, follow-up questions and optional caller history protected by a keypad PIN. Speech recognition and answer generation integrate official N-ATLaS models. English playback is built in; Nigerian-language playback will be enabled after its audio prompts and speech service are tested. The service provides health information and care guidance, and does not replace clinical care.

- Product: https://ilera-her-ai.onrender.com
- Source: https://github.com/Erioluwa23/ilera-her-ai
- Requested pilot resources: an incoming voice-capable number, incoming call minutes, recording and spoken playback, covered by approved product credits.
- Legal organisation name, registration details, authorised representative and pilot volume: supply accurate details from the nonprofit; these are not established by the repository.

This is an application brief, not a submitted application. No eligibility documents, payment details or provider credentials are stored here.

## Activation after approval

1. Confirm credits and an account upgrade removing trial calling restrictions. Check number availability and caller charges, including whether Nigerian callers can reach the selected number. Do not label an international number as a Nigerian or toll-free line.
2. Provision an owned voice-capable number only within the owner's approved credit budget. Set `IVR_PHONE_NUMBER` to that exact number and save the owning account's credentials in Render.
3. Set its incoming voice webhook to **POST https://ilera-her-ai.onrender.com/api/ivr/incoming**, or run the existing configuration script with secrets supplied securely.
4. Resolve the N-ATLaS text-model access requirement for the Hugging Face runtime token. Verify database, ASR and text-model readiness at `/api/ivr/status` while calls remain disabled.
5. Follow [activation and acceptance checks](../IVR_SETUP.md) and [the implemented caller journey](IVR_CALLS.md). Enable calls for testing, verify replay, follow-ups and PIN-protected continuity on real calls, then publish the number.

If approval or country eligibility is unavailable, the public number remains blocked until a sponsor or another approved provider funds a real line. Browser calling and provider simulators do not satisfy this ordinary-phone requirement.
