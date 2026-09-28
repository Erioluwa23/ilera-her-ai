import {NATLAS_ASR_MODELS} from "@/lib/languages";
export type SupportedLanguage="en-NG"|"yo"|"ha"|"ig";
export type Transcript={text:string;language?:SupportedLanguage;model?:string;provider?:"self-hosted"|"hf-inference"};

export interface SpeechProvider{transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>}

export function huggingFaceToken(){
  return process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY||process.env.HUGGINGFACE_TOKEN;
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

export class NatlasSpeechProvider implements SpeechProvider{
 async transcribe(audio:Blob,language:SupportedLanguage="en-NG"):Promise<Transcript>{
  const model=NATLAS_ASR_MODELS[language];
  const url=languageEndpoint(language);
  const endpointKey=process.env.NATLAS_ASR_API_KEY||process.env.NATLAS_API_KEY;

  if(url){
    const body=new FormData();
    body.append("audio",audio,"speech.webm");
    body.append("language",language);
    body.append("model",model);
    const headers:Record<string,string>={};
    if(endpointKey)headers.Authorization=`Bearer ${endpointKey}`;
    const res=await fetch(url,{method:"POST",headers,body});
    if(!res.ok)throw new Error(`N-ATLAS ASR endpoint failed (${res.status}): ${await parseError(res)}`);
    const data=await res.json();
    const text=data?.text??data?.transcription??data?.result?.text;
    if(typeof text!=="string")throw new Error("Invalid N-ATLAS ASR response");
    return{text,language,model,provider:"self-hosted"};
  }

  const hfToken=huggingFaceToken();
  if(!hfToken)throw new Error("N-ATLAS ASR needs either an inference endpoint or a Hugging Face token.");

  const hfUrl=`https://router.huggingface.co/hf-inference/models/${model}`;
  const res=await fetch(hfUrl,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${hfToken}`,
      "Content-Type":audio.type||"audio/webm"
    },
    body:audio
  });
  if(!res.ok){
    throw new Error(`N-ATLAS Hugging Face ASR unavailable (${res.status}): ${await parseError(res)}`);
  }
  const data=await res.json();
  const text=data?.text??data?.transcription;
  if(typeof text!=="string")throw new Error("Invalid Hugging Face ASR response");
  return{text,language,model,provider:"hf-inference"};
 }
}

export class NatlasLLMProvider{
 async answer(question:string,groundedContext:unknown,language:SupportedLanguage="en-NG"):Promise<string>{
  const configuredUrl=process.env.NATLAS_LLM_API_URL;
  const endpointKey=process.env.NATLAS_LLM_API_KEY;
  const hfToken=huggingFaceToken();
  const url=configuredUrl||"https://router.huggingface.co/v1/chat/completions";
  const key=endpointKey||hfToken;
  const model=process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS";
  if(!configuredUrl&&!hfToken)throw new Error("N-ATLAS LLM needs either an inference endpoint or a Hugging Face token.");

  const languageInstruction:Record<SupportedLanguage,string>={
    "en-NG":"Reply in clear Nigerian English.",
    yo:"Reply entirely in natural Yorùbá, preserving medical meaning.",
    ha:"Reply entirely in natural Hausa, preserving medical meaning.",
    ig:"Reply entirely in natural Igbo, preserving medical meaning."
  };

  const headers:Record<string,string>={"content-type":"application/json"};
  if(key)headers.Authorization=`Bearer ${key}`;
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

  const res=await fetch(url,{method:"POST",headers,body:JSON.stringify({
    model,temperature:0.1,max_tokens:700,stream:false,
    messages:[
      {role:"system",content:system},
      {role:"user",content:`GROUNDED_CONTEXT:\n${JSON.stringify(groundedContext)}\n\nUSER_QUESTION:\n${question}`}
    ]
  })});
  if(!res.ok)throw new Error(`N-ATLAS LLM failed (${res.status}): ${await parseError(res)}`);
  const data=await res.json();
  const text=data?.choices?.[0]?.message?.content??data?.text??data?.generated_text;
  if(typeof text!=="string"||!text.trim())throw new Error("Invalid N-ATLAS LLM response");
  return text.trim();
 }
}
export class NatlasProvider extends NatlasSpeechProvider{}
