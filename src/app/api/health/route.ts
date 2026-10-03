import {NATLAS_ASR_MODELS} from "@/lib/languages";
import {huggingFaceToken} from "@/lib/natlas";

export async function GET(){
  return Response.json({
    ok:true,
    service:"ileraher-ai",
    channels:{web:true,lowBandwidth:"/lite",ivr:"/api/ivr/incoming"},
    natlas:{
      huggingFaceTokenConfigured:Boolean(huggingFaceToken()),
      asrConfigured:Boolean(process.env.NATLAS_ASR_API_URL||process.env.NATLAS_ASR_EN_NG_URL||process.env.NATLAS_ASR_YO_URL||process.env.NATLAS_ASR_HA_URL||process.env.NATLAS_ASR_IG_URL||process.env.NATLAS_API_URL),
      llmConfigured:true,
      llmMode:process.env.NATLAS_LLM_API_URL?"custom-endpoint":"huggingface-space",
      asrMode:process.env.NATLAS_ASR_API_URL?"custom-endpoint":"huggingface-spaces",
      llmModel:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS",
      asrModels:NATLAS_ASR_MODELS
    }
  });
}
