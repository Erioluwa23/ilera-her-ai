import {NATLAS_ASR_MODELS} from "@/lib/languages";
import {huggingFaceToken} from "@/lib/natlas";
import {inspectNatlasSpace,natlasSpaceId} from "@/lib/natlas-space";

export async function GET(){
  let runtimeStatus:{ready:boolean;[key:string]:unknown};
  try{runtimeStatus=await inspectNatlasSpace()}catch{runtimeStatus={reachable:false,gatedModelsAccessible:null,inferenceTested:false,ready:false}}
  return Response.json({
    ok:true,
    service:"ileraher-ai",
    channels:{web:true,lowBandwidth:"/lite",ivr:"/api/ivr/incoming"},
    natlas:{
      huggingFaceTokenConfigured:Boolean(huggingFaceToken()),
      asrConfigured:true,
      asrSpaceConfigured:true,
      asrSpace:natlasSpaceId(),
      asrMode:"fixed-gradio-space",
      asrReady:runtimeStatus.ready,
      runtime:runtimeStatus,
      llmConfigured:Boolean(process.env.NATLAS_LLM_API_URL||process.env.NATLAS_HF_LLM_SPACE),
      llmMode:process.env.NATLAS_LLM_API_URL?"custom-endpoint":process.env.NATLAS_HF_LLM_SPACE?"huggingface-space":"curated-fallback",
      llmModel:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS",
      asrModels:NATLAS_ASR_MODELS
    }
  },{headers:{"cache-control":"no-store"}});
}
