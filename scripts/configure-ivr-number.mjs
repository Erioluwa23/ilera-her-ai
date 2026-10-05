// Run with secrets supplied by your trusted shell or Render environment; never commit them.
import twilio from "twilio";
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  IVR_PHONE_NUMBER,
  IVR_PUBLIC_BASE_URL,
} = process.env;
if (
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !/^\+[1-9]\d{6,14}$/.test(IVR_PHONE_NUMBER || "")
)
  throw new Error(
    "Configure provider credentials and an owned E164 number first.",
  );
const origin = new URL(IVR_PUBLIC_BASE_URL || "");
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/"
)
  throw new Error("Configure an HTTPS public origin.");
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, {
  timeout: 10000,
});
const numbers = await client.incomingPhoneNumbers.list({
  phoneNumber: IVR_PHONE_NUMBER,
  limit: 1,
});
const number = numbers.find((number) => number.capabilities.voice);
if (!number)
  throw new Error("No matching voice-capable number owned by this account.");
await client
  .incomingPhoneNumbers(number.sid)
  .update({
    voiceUrl: origin.origin + "/api/ivr/incoming",
    voiceMethod: "POST",
  });
console.log(
  "Owned voice number configured. Verify model readiness and place the acceptance test calls before publishing the number.",
);
