import { NATLAS_ASR_MODELS } from "@/lib/languages";
import { huggingFaceToken } from "@/lib/natlas";
import { inspectNatlasSpace, natlasSpaceId } from "@/lib/natlas-space";
import { cycleStorageReady } from "@/lib/cycle-prediction/health";
import { MODEL_VERSION } from "@/lib/cycle-prediction/types";

export async function GET() {
  const cycleReady = cycleStorageReady();
  let runtimeStatus: { ready: boolean; [key: string]: unknown };
  try {
    runtimeStatus = await inspectNatlasSpace();
  } catch {
    runtimeStatus = {
      reachable: false,
      gatedModelsAccessible: null,
      inferenceTested: false,
      ready: false,
    };
  }
  return Response.json(
    {
      ok: true,
      service: "ileraher-ai",
      cyclePrediction: {
        modelVersion: MODEL_VERSION,
        storageReady: await cycleReady,
      },
      channels: { web: true, lowBandwidth: "/lite", ivr: "/api/ivr/incoming" },
      natlas: {
        huggingFaceTokenConfigured: Boolean(huggingFaceToken()),
        asrConfigured: true,
        asrSpaceConfigured: true,
        asrSpace: natlasSpaceId(),
        asrMode: "fixed-gradio-space",
        asrReady: runtimeStatus.ready,
        runtime: runtimeStatus,
        llmConfigured: true,
        llmMode: process.env.NATLAS_LLM_API_URL
          ? "custom-endpoint"
          : "huggingface-space",
        ttsModel: "saheedniyi/YarnGPT2b",
        llmModel: process.env.NATLAS_LLM_MODEL || "NCAIR1/N-ATLaS",
        asrModels: NATLAS_ASR_MODELS,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
