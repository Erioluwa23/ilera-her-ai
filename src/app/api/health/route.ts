import {NATLAS_ASR_MODELS} from "@/lib/languages";
import {huggingFaceToken} from "@/lib/natlas";
import {natlasSpaceId} from "@/lib/natlas-space";

export async function GET(){
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
      asrConfigured:true,
      asrSpaceConfigured:true,
      asrSpace:natlasSpaceId(),
      asrMode:customAsrConfigured?"custom-endpoint":"fixed-gradio-space",
      llmConfigured:Boolean(process.env.NATLAS_LLM_API_URL||process.env.NATLAS_HF_LLM_SPACE),
      llmMode:process.env.NATLAS_LLM_API_URL?"custom-endpoint":process.env.NATLAS_HF_LLM_SPACE?"huggingface-space":"curated-fallback",
      llmModel:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS",
      asrModels:NATLAS_ASR_MODELS
    }
  },{headers:{"cache-control":"no-store"}});
}
