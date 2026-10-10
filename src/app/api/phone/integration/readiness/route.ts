import { getDb } from "@/lib/db";
import { inspectNatlasSpace } from "@/lib/natlas-space";
import { ensurePhoneSchema, PHONE_LANGUAGES, phoneFailure, phoneResponse, requirePhoneIntegration } from "@/lib/phone-pilot";

export const runtime = "nodejs";

// Operator diagnostics remain available while calls are paused. This never
// publishes the number anonymously or claims that loaded models have GPU quota.
export async function GET(req: Request) {
  try {
    requirePhoneIntegration(req, false);
    const number = process.env.SIM_PHONE_NUMBER || "";
    const phoneNumber = /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
    const enabled = process.env.SIM_PHONE_ENABLED === "true";
    const verified = process.env.SIM_PHONE_VERIFIED === "true";
    const [gatewayResult, modelResult] = await Promise.allSettled([
      (async () => {
        await ensurePhoneSchema();
        const result = await getDb().query(
          "SELECT gateway_ready,languages,checked_at,checked_at>now()-interval '90 seconds' AS recent FROM phone_gateway_status WHERE id=1",
        );
        return result.rows[0];
      })(),
      inspectNatlasSpace(),
    ]);
    const row = gatewayResult.status === "fulfilled" ? gatewayResult.value : undefined;
    const state: Record<string, unknown> = modelResult.status === "fulfilled" ? modelResult.value : {};
    const installed = PHONE_LANGUAGES.filter(language => Array.isArray(row?.languages) && row.languages.includes(language));
    const externalTts = Boolean(process.env.VOICE_TTS_API_URL);
    const ttsLanguages = externalTts
      ? (process.env.VOICE_TTS_LANGUAGES || "").split(",").map(value => value.trim())
      : PHONE_LANGUAGES;
    const languages = installed.filter(language => ttsLanguages.includes(language));
    const gateway = {
      checked: gatewayResult.status === "fulfilled",
      recent: row?.recent === true,
      ready: row?.recent === true && row?.gateway_ready === true,
      checkedAt: row?.checked_at instanceof Date ? row.checked_at.toISOString() : null,
      languages: installed,
    };
    const models = {
      checked: modelResult.status === "fulfilled",
      reachable: state.reachable === true,
      asrLoaded: state.gatedModelsAccessible === true && state.modelsLoaded === true,
      textLoaded: state.llmLoaded === true,
      textAccess: typeof state.llmAccess === "boolean" ? state.llmAccess : null,
      textFailure: ["access", "load"].includes(String(state.llmFailureCategory)) ? state.llmFailureCategory : null,
      textCredential: process.env.NATLAS_LLM_API_URL ? "configured-endpoint" : "space-secret",
      textFallback: "curated",
      speechLoaded: externalTts ? null : state.ttsLoaded === true,
      speechMode: externalTts ? "configured-endpoint" : "yarngpt",
      // A status call neither acquires a GPU nor proves remaining quota.
      speechComputeTested: false,
    };
    const blockers: string[] = [];
    if (!phoneNumber) blockers.push("phone_number");
    if (!enabled) blockers.push("pilot_paused");
    if (!verified) blockers.push("inbound_call_unverified");
    if (!gateway.checked) blockers.push("gateway_status_unavailable");
    else if (!gateway.ready) blockers.push("gateway_offline");
    if (!languages.length) blockers.push("reviewed_prompts_missing");
    if (!models.reachable || !models.asrLoaded) blockers.push("asr_runtime_unavailable");
    if (!externalTts && !models.speechLoaded) blockers.push("speech_runtime_unavailable");
    const publicReady = Boolean(phoneNumber && enabled && verified && gateway.ready && languages.length &&
      models.reachable && models.asrLoaded && (externalTts || models.speechLoaded));
    return phoneResponse({ provider: "sim", capacity: 1, phoneNumber, enabled, verified,
      publicReady, languages, gateway, models, blockers });
  } catch (error) { return phoneFailure(error); }
}
