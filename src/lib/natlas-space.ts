import {Client} from "@gradio/client";
import type {SupportedLanguage} from "@/lib/natlas";

const LANGUAGE_LABELS:Record<SupportedLanguage,string>={
  "en-NG":"Nigerian English",
  yo:"Yoruba",
  ha:"Hausa",
  ig:"Igbo"
};

const DEFAULT_ASR_SPACES:Record<SupportedLanguage,string[]>={
  "en-NG":["panamabananaman/NCAIR-Audio-Demo"],
  yo:["ayscript/NCAIR-Yoruba"],
  ha:["DevEmmy/scriptflow-hausa"],
  ig:["panamabananaman/igbo-asr"]
};

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function configuredAsrSpaces(language:SupportedLanguage){
  const specific:Record<SupportedLanguage,string|undefined>={
    "en-NG":process.env.NATLAS_HF_SPACE_EN_NG,
    yo:process.env.NATLAS_HF_SPACE_YO,
    ha:process.env.NATLAS_HF_SPACE_HA,
    ig:process.env.NATLAS_HF_SPACE_IG
  };
  const shared=process.env.NATLAS_HF_SPACE;
  const configured=(specific[language]||shared||"")
    .split(",").map(x=>x.trim()).filter(Boolean);
  return configured.length?configured:DEFAULT_ASR_SPACES[language];
}

export function natlasSpaceId(language:SupportedLanguage){
  return configuredAsrSpaces(language)[0];
}

export function natlasLlmSpaceId(){
  return process.env.NATLAS_HF_LLM_SPACE?.trim()||null;
}

async function connectWithRetry(space:string){
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await Client.connect(space);
    }catch(error){
      lastError=error;
      if(attempt<2)await sleep(attempt===0?2500:7000);
    }
  }
  const message=lastError instanceof Error?lastError.message:String(lastError);
  throw new Error(`N-ATLAS Hugging Face Space ${space} is unavailable after retries: ${message}`);
}

function isAudioParam(p:any){
  const component=String(p?.component||"").toLowerCase();
  const type=String(p?.type||p?.python_type?.type||"").toLowerCase();
  const name=String(p?.parameter_name||p?.label||"").toLowerCase();
  return component.includes("audio")||type.includes("audio")||name.includes("audio");
}

function isLanguageParam(p:any){
  const name=String(p?.parameter_name||p?.label||"").toLowerCase();
  return name.includes("language")||name==="lang";
}

function extractText(value:any):string|undefined{
  if(typeof value==="string"&&value.trim())return value.trim();
  if(Array.isArray(value)){
    for(const item of value){
      const text=extractText(item);
      if(text)return text;
    }
  }
  if(value&&typeof value==="object"){
    for(const key of ["text","transcription","transcript","output","result","value","data"]){
      const text=extractText(value[key]);
      if(text)return text;
    }
  }
  return undefined;
}

async function transcribeOne(space:string,audio:Blob,language:SupportedLanguage){
  const app=await connectWithRetry(space);
  const api:any=await app.view_api();
  const entries=Object.entries(api?.named_endpoints||{}) as [string,any][];
  const candidates=entries
    .filter(([,info])=>Array.isArray(info?.parameters)&&info.parameters.some(isAudioParam))
    .sort((a,b)=>{
      const score=(entry:[string,any])=>{
        const params=entry[1]?.parameters||[];
        return params.filter((p:any)=>!p?.parameter_has_default&&!isAudioParam(p)&&!isLanguageParam(p)).length;
      };
      return score(a)-score(b);
    });

  if(!candidates.length)throw new Error(`Space ${space} exposes no audio API endpoint.`);
  const [endpoint,info]=candidates[0];
  const payload=(info.parameters||[]).map((p:any)=>{
    if(isAudioParam(p))return audio;
    if(isLanguageParam(p))return LANGUAGE_LABELS[language];
    if(p?.parameter_has_default)return p?.parameter_default;
    return null;
  });

  const result:any=await app.predict(endpoint,payload);
  const text=extractText(result?.data);
  if(!text)throw new Error(`Space ${space} returned no transcription text.`);
  return {text,endpoint,space};
}

export async function inspectNatlasSpace(language:SupportedLanguage){
  const spaces=configuredAsrSpaces(language);
  const checks=[];
  for(const space of spaces){
    try{
      const app=await connectWithRetry(space);
      const api:any=await app.view_api();
      checks.push({space,ok:true,endpoints:Object.keys(api?.named_endpoints||{})});
    }catch(error){
      checks.push({space,ok:false,error:error instanceof Error?error.message:String(error)});
    }
  }
  return {language,spaces:checks};
}

export async function transcribeViaNatlasSpace(audio:Blob,language:SupportedLanguage){
  const failures:string[]=[];
  for(const space of configuredAsrSpaces(language)){
    try{
      return await transcribeOne(space,audio,language);
    }catch(error){
      failures.push(`${space}: ${error instanceof Error?error.message:String(error)}`);
    }
  }
  throw new Error(`No configured N-ATLAS ASR Space is currently available. ${failures.join(" | ")}`);
}

function textParamKind(p:any){
  const name=String(p?.parameter_name||p?.label||"").toLowerCase();
  const component=String(p?.component||"").toLowerCase();
  const type=String(p?.type||p?.python_type?.type||"").toLowerCase();
  if(name.includes("system"))return "system";
  if(name.includes("history")||name.includes("chatbot")||component.includes("chatbot"))return "history";
  if(name.includes("language")||name==="lang")return "language";
  if(name.includes("model"))return "model";
  if(name.includes("task"))return "task";
  if(name.includes("temperature"))return "temperature";
  if(name.includes("token")||name.includes("length"))return "tokens";
  if(name.includes("message")||name.includes("question")||name.includes("prompt")||name.includes("input")||component.includes("textbox")||type.includes("str"))return "text";
  return "other";
}

export async function generateViaNatlasSpace(
  question:string,
  groundedContext:unknown,
  language:SupportedLanguage,
  system:string
){
  const space=natlasLlmSpaceId();
  if(!space){
    throw new Error("N-ATLAS LLM Hugging Face Space is not configured. Set NATLAS_HF_LLM_SPACE to the project-owned ZeroGPU Space.");
  }

  const app=await connectWithRetry(space);
  const api:any=await app.view_api();
  const entries=Object.entries(api?.named_endpoints||{}) as [string,any][];
  const candidates=entries
    .filter(([,info])=>Array.isArray(info?.parameters)&&info.parameters.some((p:any)=>{
      const kind=textParamKind(p);
      return kind==="text"||kind==="history";
    }))
    .sort((a,b)=>{
      const score=(entry:[string,any])=>{
        const params=entry[1]?.parameters||[];
        const unsupportedRequired=params.filter((p:any)=>!p?.parameter_has_default&&textParamKind(p)==="other").length;
        const textCount=params.filter((p:any)=>textParamKind(p)==="text").length;
        return unsupportedRequired*10-Math.min(textCount,2);
      };
      return score(a)-score(b);
    });

  if(!candidates.length)throw new Error(`N-ATLAS LLM Space ${space} exposes no usable text API endpoint.`);

  const [endpoint,info]=candidates[0];
  const fullPrompt=`${system}\n\nGROUNDED_CONTEXT:\n${JSON.stringify(groundedContext)}\n\nUSER_QUESTION:\n${question}`;
  let textUsed=false;

  const payload=(info.parameters||[]).map((p:any)=>{
    const kind=textParamKind(p);
    if(kind==="system")return system;
    if(kind==="history")return [];
    if(kind==="language")return LANGUAGE_LABELS[language];
    if(kind==="model")return "NCAIR1/N-ATLaS";
    if(kind==="task")return "Chat";
    if(kind==="temperature")return p?.parameter_has_default?p?.parameter_default:0.1;
    if(kind==="tokens")return p?.parameter_has_default?p?.parameter_default:700;
    if(kind==="text"){
      if(!textUsed){textUsed=true;return fullPrompt}
      return question;
    }
    if(p?.parameter_has_default)return p?.parameter_default;
    return null;
  });

  const result:any=await app.predict(endpoint,payload);
  const text=extractText(result?.data);
  if(!text)throw new Error("N-ATLAS LLM Space returned no response text.");
  return {text,endpoint,space};
}
