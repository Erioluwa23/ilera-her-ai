import { getDb } from "@/lib/db";
import { inspectNatlasSpace } from "@/lib/natlas-space";
import { ensurePhoneSchema, PHONE_LANGUAGES, phoneResponse } from "@/lib/phone-pilot";
export const runtime = "nodejs";
export async function GET() {
  const configured = (process.env.PHONE_INTEGRATION_KEY?.length || 0) >= 32;
  const enabled = process.env.SIM_PHONE_ENABLED === "true";
  const verified = process.env.SIM_PHONE_VERIFIED === "true";
  const number = process.env.SIM_PHONE_NUMBER || "";
  const unavailable = { provider: "sim", configured, ready: false, phoneNumber: null, languages: [], capacity: 1 };
  if (!configured || !enabled || !verified || !/^\+[1-9]\d{7,14}$/.test(number)) return phoneResponse(unavailable);
  try {
    await ensurePhoneSchema();
    const [heartbeat, runtime] = await Promise.all([
      getDb().query("SELECT gateway_ready,languages FROM phone_gateway_status WHERE id=1 AND checked_at>now()-interval '90 seconds'"),
      inspectNatlasSpace(),
    ]);
    const row = heartbeat.rows[0];
    const externalTts = !!process.env.VOICE_TTS_API_URL;
    const ttsLanguages = externalTts ? (process.env.VOICE_TTS_LANGUAGES || "").split(",").map(s => s.trim()) : PHONE_LANGUAGES;
    const languages = PHONE_LANGUAGES.filter(l => row?.languages?.includes(l) && ttsLanguages.includes(l));
    const ready = !!row?.gateway_ready && runtime.reachable === true && runtime.gatedModelsAccessible === true &&
      "modelsLoaded" in runtime && runtime.modelsLoaded === true &&
      (externalTts || ("ttsLoaded" in runtime && runtime.ttsLoaded === true)) && languages.length > 0;
    return phoneResponse({ ...unavailable, ready, languages: ready ? languages : [], phoneNumber: ready ? number : null });
  } catch { return phoneResponse(unavailable); }
}
