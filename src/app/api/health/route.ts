import {NATLAS_ASR_MODELS} from "@/lib/languages";
import {huggingFaceToken} from "@/lib/natlas";

export async function GET(){
  const asrSpaceConfigured=Boolean(process.env.NATLAS_HF_SPACE?.trim());
  const customAsrConfigured=Boolean(
    process.env.NATLAS_ASR_API_URL||
    process.env.NATLAS_ASR_EN_NG_URL||
    process.env.NATLAS_ASR_YO_URL||
    process.env.NATLAS_ASR_HA_URL||
    process.env.NATLAS_ASR_IG_URL||
    process.env.NATLAS_API_URL
  );
  return Response.json({
    ok:true,
    service:"ileraher-ai",
    channels:{web:true,lowBandwidth:"/lite",ivr:"/api/ivr/incoming"},
    natlas:{
      huggingFaceTokenConfigured:Boolean(huggingFaceToken()),
      asrConfigured:asrSpaceConfigured||customAsrConfigured,
      asrSpaceConfigured,
      asrMode:customAsrConfigured?"custom-endpoint":asrSpaceConfigured?"huggingface-space":"unconfigured",
      llmConfigured:Boolean(process.env.NATLAS_LLM_API_URL||process.env.NATLAS_HF_LLM_SPACE),
      llmMode:process.env.NATLAS_LLM_API_URL?"custom-endpoint":process.env.NATLAS_HF_LLM_SPACE?"huggingface-space":"curated-fallback",
      llmModel:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS",
      asrModels:NATLAS_ASR_MODELS
    }
  },{headers:{"cache-control":"no-store"}});
}
