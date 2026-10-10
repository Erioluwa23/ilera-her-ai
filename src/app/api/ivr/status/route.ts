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
    providerVerified = false,
    publicCallingAllowed = false,
    numberOwned = false,
    webhookConfigured = false;
  let accountType: "Trial" | "Full" | null = null;
  let client: ReturnType<typeof twilio> | undefined;
  try {
    if (config.checks.provider)
      client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
        { timeout: 5000 },
      );
  } catch {}
  // Read-only setup checks run before activation. One failing dependency must not
  // conceal the status of the others, or require accepting calls to diagnose it.
  const result = await Promise.allSettled([
    config.checks.database ? databaseReady() : Promise.resolve(false),
    inspectNatlasSpace(),
    client
      ? client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch()
      : Promise.resolve(null),
    client && config.checks.number
      ? client.incomingPhoneNumbers.list({
          phoneNumber: process.env.IVR_PHONE_NUMBER,
          limit: 1,
        })
      : Promise.resolve(null),
  ]);
  database = result[0].status === "fulfilled" && result[0].value === true;
  if (result[1].status === "fulfilled" && result[1].value) {
    const runtime = result[1].value;
    // An overridden official text endpoint still needs operator acceptance calls.
    llm =
      !!process.env.NATLAS_LLM_API_URL ||
      ("llmLoaded" in runtime && runtime.llmLoaded === true);
    asr =
      runtime.reachable === true &&
      runtime.gatedModelsAccessible === true &&
      "modelsLoaded" in runtime &&
      runtime.modelsLoaded === true;
  }
  if (result[2].status === "fulfilled" && result[2].value) {
    const account = result[2].value;
    providerVerified = account.sid === process.env.TWILIO_ACCOUNT_SID;
    if (providerVerified) {
      accountType = account.type;
      // Trial accounts restrict callers and cannot support the public dial-in flow.
      publicCallingAllowed = account.status === "active" && account.type === "Full";
    }
  }
  if (result[3].status === "fulfilled" && result[3].value) {
    const number = result[3].value.find(
      (n) => n.phoneNumber === process.env.IVR_PHONE_NUMBER && n.capabilities.voice,
    );
    numberOwned = !!number;
    webhookConfigured =
      !!number &&
      config.checks.origin &&
      number.voiceUrl ===
        process.env.IVR_PUBLIC_BASE_URL?.replace(/\/$/, "") + "/api/ivr/incoming" &&
      number.voiceMethod === "POST";
  }
  const numberVerified = numberOwned && webhookConfigured;
  const setupReady =
    Object.entries(config.checks).every(([key, value]) => key === "enabled" || value) &&
    database && asr && llm && publicCallingAllowed && numberVerified;
  const ready = config.checks.enabled && setupReady;
  return Response.json(
    {
      ready,
      setupReady,
      accountType,
      checks: {
        ...config.checks,
        databaseReachable: database,
        providerVerified,
        publicCallingAllowed,
        numberOwned,
        webhookConfigured,
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
