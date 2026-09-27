import {NATLAS_ASR_MODELS} from "@/lib/languages";

function hfTokenConfigured(){
  return Boolean(process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY||process.env.HUGGINGFACE_TOKEN);
}

export async function GET(){
  return Response.json({
    ok:true,
    service:"ileraher-ai",
    channels:{web:true,lowBandwidth:"/lite",ivr:"/api/ivr/incoming"},
    natlas:{
      huggingFaceTokenConfigured:hfTokenConfigured(),
      asrConfigured:Boolean(process.env.NATLAS_ASR_API_URL||process.env.NATLAS_ASR_EN_NG_URL||process.env.NATLAS_ASR_YO_URL||process.env.NATLAS_ASR_HA_URL||process.env.NATLAS_ASR_IG_URL||process.env.NATLAS_API_URL),
      llmConfigured:Boolean(process.env.NATLAS_LLM_API_URL),
      llmModel:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS",
      asrModels:NATLAS_ASR_MODELS
    }
  });
}
