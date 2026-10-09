import { historyEnabled } from "@/lib/ivr-profiles";
import twilio from "twilio";
import { configuration } from "@/lib/ivr";
import { databaseReady } from "@/lib/ivr-jobs";
import { inspectNatlasSpace } from "@/lib/natlas-space";
export async function GET() {
  const config = configuration();
  let database = false,
    asr = false,
    llm = false,
    numberVerified = false;
  {
    // Verify storage independently of phone activation so setup can be tested safely.
    const result = await Promise.allSettled([
      config.checks.database ? databaseReady() : Promise.resolve(false),
      config.configured ? inspectNatlasSpace() : Promise.resolve(null),
    ]);
    database = result[0].status === "fulfilled" && result[0].value === true;
    if (result[1].status === "fulfilled" && result[1].value) {
      const runtime = result[1].value;
      // The shared text model must be loaded before publishing personalised phone support.
      // A separately configured official endpoint is validated during operator acceptance calls.
      llm =
        !!process.env.NATLAS_LLM_API_URL ||
        ("llmLoaded" in runtime && runtime.llmLoaded === true);
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
  const ready = config.configured && database && asr && llm && numberVerified;
  return Response.json(
    {
      ready,
      checks: {
        ...config.checks,
        databaseReachable: database,
        numberVerified,
        asrReachable: asr,
        llmReady: llm,
      },
      languages: config.languages,
      historyLanguages: config.languages.filter(historyEnabled),
      phoneNumber: ready ? process.env.IVR_PHONE_NUMBER : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
