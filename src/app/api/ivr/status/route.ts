import twilio from "twilio";
import { configuration } from "@/lib/ivr";
import { databaseReady } from "@/lib/ivr-jobs";
import { inspectNatlasSpace } from "@/lib/natlas-space";
export async function GET() {
  const config = configuration();
  let database = false,
    asr = false,
    numberVerified = false;
  if (config.configured) {
    const result = await Promise.allSettled([
      databaseReady(),
      inspectNatlasSpace(),
    ]);
    database = result[0].status === "fulfilled" && result[0].value === true;
    if (result[1].status === "fulfilled") {
      const runtime = result[1].value;
      asr =
        runtime.reachable === true &&
        runtime.gatedModelsAccessible === true &&
        "modelsLoaded" in runtime &&
        runtime.modelsLoaded === true;
    }
  }
  if (config.configured) {
    try {
      const numbers = await twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
        { timeout: 5000 },
      ).incomingPhoneNumbers.list({
        phoneNumber: process.env.IVR_PHONE_NUMBER,
        limit: 1,
      });
      numberVerified = numbers.some(
        (n) =>
          n.capabilities.voice &&
          n.voiceUrl ===
            process.env.IVR_PUBLIC_BASE_URL?.replace(/\/$/, "") +
              "/api/ivr/incoming" &&
          n.voiceMethod === "POST",
      );
    } catch {}
  }
  const ready = config.configured && database && asr && numberVerified;
  return Response.json(
    {
      ready,
      checks: {
        ...config.checks,
        databaseReachable: database,
        numberVerified,
        asrReachable: asr,
      },
      languages: config.languages,
      phoneNumber: ready ? process.env.IVR_PHONE_NUMBER : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
