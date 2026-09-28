import {NATLAS_ASR_MODELS} from "@/lib/languages";
export type SupportedLanguage="en-NG"|"yo"|"ha"|"ig";
export type Transcript={
  text:string;
  language?:SupportedLanguage;
  model?:string;
  provider?:"self-hosted"|"hf-inference";
  natlas?:boolean;
};

export type LlmAnswer={
  text:string;
  model:string;
  provider:"self-hosted"|"hf-inference";
  natlas:boolean;
};

export interface SpeechProvider{transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>}

export function huggingFaceToken(){
  return process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY||process.env.HUGGINGFACE_TOKEN;
}

export function hfAsrFallbackModel(){
  return process.env.HF_ASR_FALLBACK_MODEL||"openai/whisper-large-v3";
}

export function hfLlmFallbackModel(){
  return process.env.HF_LLM_FALLBACK_MODEL||"Qwen/Qwen3-8B:fastest";
}

function languageEndpoint(language:SupportedLanguage){
  const specific:Record<SupportedLanguage,string|undefined>={
    "en-NG":process.env.NATLAS_ASR_EN_NG_URL,
    yo:process.env.NATLAS_ASR_YO_URL,
    ha:process.env.NATLAS_ASR_HA_URL,
    ig:process.env.NATLAS_ASR_IG_URL
  };
  return specific[language]||process.env.NATLAS_ASR_API_URL||process.env.NATLAS_API_URL;
}

async function parseError(res:Response){
  try{
    const data=await res.clone().json();
    return String(data?.error??data?.message??data?.detail??res.statusText).slice(0,240);
  }catch{
    try{return (await res.text()).slice(0,240)}catch{return res.statusText}
  }
}

async function hfAsr(audio:Blob,model:string,token:string){
  const url=`https://router.huggingface.co/hf-inference/models/${model}`;
  const res=await fetch(url,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${token}`,
      "Content-Type":audio.type||"audio/webm"
    },
    body:audio
  });
  if(!res.ok)throw new Error(`${model} failed (${res.status}): ${await parseError(res)}`);
  const data=await res.json();
  const text=data?.text??data?.transcription;
  if(typeof text!=="string"||!text.trim())throw new Error(`${model} returned an invalid ASR response`);
  return text.trim();
}

export class NatlasSpeechProvider implements SpeechProvider{
 async transcribe(audio:Blob,language:SupportedLanguage="en-NG"):Promise<Transcript>{
  const natlasModel=NATLAS_ASR_MODELS[language];
  const url=languageEndpoint(language);
  const endpointKey=process.env.NATLAS_ASR_API_KEY||process.env.NATLAS_API_KEY;

  if(url){
    const body=new FormData();
    body.append("audio",audio,"speech.webm");
    body.append("language",language);
    body.append("model",natlasModel);
    const headers:Record<string,string>={};
    if(endpointKey)headers.Authorization=`Bearer ${endpointKey}`;
    const res=await fetch(url,{method:"POST",headers,body});
    if(!res.ok)throw new Error(`N-ATLAS ASR endpoint failed (${res.status}): ${await parseError(res)}`);
    const data=await res.json();
    const text=data?.text??data?.transcription??data?.result?.text;
    if(typeof text!=="string")throw new Error("Invalid N-ATLAS ASR response");
    return{text,language,model:natlasModel,provider:"self-hosted",natlas:true};
  }

  const token=huggingFaceToken();
  if(!token)throw new Error("HF_TOKEN is not available to the app runtime.");

  try{
    const text=await hfAsr(audio,natlasModel,token);
    return{text,language,model:natlasModel,provider:"hf-inference",natlas:true};
  }catch(natlasError){
    const fallbackModel=hfAsrFallbackModel();
    try{
      const text=await hfAsr(audio,fallbackModel,token);
      return{text,language,model:fallbackModel,provider:"hf-inference",natlas:false};
    }catch(fallbackError){
      const a=natlasError instanceof Error?natlasError.message:String(natlasError);
      const b=fallbackError instanceof Error?fallbackError.message:String(fallbackError);
      throw new Error(`Hugging Face ASR failed. N-ATLAS: ${a}. Fallback: ${b}`);
    }
  }
 }
}

async function chatRequest(url:string,key:string|undefined,model:string,system:string,question:string,groundedContext:unknown){
  const headers:Record<string,string>={"content-type":"application/json"};
  if(key)headers.Authorization=`Bearer ${key}`;
  const res=await fetch(url,{method:"POST",headers,body:JSON.stringify({
    model,temperature:0.1,max_tokens:700,stream:false,
    messages:[
      {role:"system",content:system},
      {role:"user",content:`GROUNDED_CONTEXT:\n${JSON.stringify(groundedContext)}\n\nUSER_QUESTION:\n${question}`}
    ]
  })});
  if(!res.ok)throw new Error(`${model} failed (${res.status}): ${await parseError(res)}`);
  const data=await res.json();
  const text=data?.choices?.[0]?.message?.content??data?.text??data?.generated_text;
  if(typeof text!=="string"||!text.trim())throw new Error(`${model} returned an invalid chat response`);
  return text.trim();
}

export class NatlasLLMProvider{
 async answer(question:string,groundedContext:unknown,language:SupportedLanguage="en-NG"):Promise<LlmAnswer>{
  const configuredUrl=process.env.NATLAS_LLM_API_URL;
  const endpointKey=process.env.NATLAS_LLM_API_KEY;
  const token=huggingFaceToken();
  const natlasModel=process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS";

  const languageInstruction:Record<SupportedLanguage,string>={
    "en-NG":"Reply in clear Nigerian English.",
    yo:"Reply entirely in natural Yorùbá, preserving medical meaning.",
    ha:"Reply entirely in natural Hausa, preserving medical meaning.",
    ig:"Reply entirely in natural Igbo, preserving medical meaning."
  };

  const system=[
    "You are ÌleraHer, a menstrual-health education assistant for Nigerian users.",
    "Use ONLY the medically reviewed facts supplied in GROUNDED_CONTEXT.",
    "Answer the user's question directly before adding any explanation.",
    "Do not invent conditions, dosages, test results, probabilities, or source claims.",
    "You may describe possible causes but must never claim a confirmed diagnosis.",
    "Preserve the urgency level and safety instructions in the grounded context.",
    languageInstruction[language],
    "Keep the answer concise and understandable."
  ].join(" ");

  if(configuredUrl){
    const text=await chatRequest(configuredUrl,endpointKey,natlasModel,system,question,groundedContext);
    return{text,model:natlasModel,provider:"self-hosted",natlas:true};
  }

  if(!token)throw new Error("HF_TOKEN is not available to the app runtime.");
  const router="https://router.huggingface.co/v1/chat/completions";

  try{
    const text=await chatRequest(router,token,natlasModel,system,question,groundedContext);
    return{text,model:natlasModel,provider:"hf-inference",natlas:true};
  }catch(natlasError){
    const fallbackModel=hfLlmFallbackModel();
    try{
      const text=await chatRequest(router,token,fallbackModel,system,question,groundedContext);
      return{text,model:fallbackModel,provider:"hf-inference",natlas:false};
    }catch(fallbackError){
      const a=natlasError instanceof Error?natlasError.message:String(natlasError);
      const b=fallbackError instanceof Error?fallbackError.message:String(fallbackError);
      throw new Error(`Hugging Face chat failed. N-ATLAS: ${a}. Fallback: ${b}`);
    }
  }
 }
}
export class NatlasProvider extends NatlasSpeechProvider{}
