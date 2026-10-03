import {Client,handle_file} from "@gradio/client";
import type {SupportedLanguage} from "@/lib/natlas";
import {NATLAS_ASR_MODELS,speechLanguageFromUi} from "@/lib/languages";

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const ILERAHER_ASR_SPACE="Erioluwa24/ileraher-natlas-runtime";

export function natlasSpaceId(){
  return ILERAHER_ASR_SPACE;
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

function extractJson(value:any){
  if(typeof value==="string"){
    try{return JSON.parse(value)}catch{return {text:value}}
  }
  if(Array.isArray(value)&&value.length===1)return extractJson(value[0]);
  if(value&&typeof value==="object"&&"data" in value)return extractJson(value.data);
  return value;
}

export async function inspectNatlasSpace(){
  const space=natlasSpaceId();
  const app=await connectWithRetry(space);
  const api:any=await app.view_api();
  return {space,endpoints:Object.keys(api?.named_endpoints||{})};
}

export async function transcribeViaNatlasSpace(audioPath:string,language:SupportedLanguage){
  const space=natlasSpaceId();
  const app=await connectWithRetry(space);
  const speechLanguage=speechLanguageFromUi(language);
  const expectedModel=NATLAS_ASR_MODELS[language];

  const result:any=await app.predict("/transcribe",[
    handle_file(audioPath),
    speechLanguage
  ]);

  const payload=extractJson(result?.data);
  const text=String(payload?.text||"").trim();
  const upstreamModel=String(payload?.model||"").trim();
  const upstreamLanguage=String(payload?.language||"").trim().toLowerCase();

  if(!text)throw new Error("ÌleraHer N-ATLAS Space returned no transcription text.");
  if(upstreamModel!==expectedModel){
    throw new Error(`ASR provenance check failed: expected ${expectedModel}, received ${upstreamModel||"no model id"}.`);
  }
  if(upstreamLanguage&&upstreamLanguage!==speechLanguage){
    throw new Error(`ASR language provenance check failed: expected ${speechLanguage}, received ${upstreamLanguage}.`);
  }

  return {
    text,
    model:upstreamModel,
    language:speechLanguage,
    provider:String(payload?.provider||"ileraher_gradio_asr"),
    space
  };
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

function extractText(value:any):string|undefined{
  if(typeof value==="string"&&value.trim())return value.trim();
  if(Array.isArray(value)){
    for(const item of value){
      const text=extractText(item);
      if(text)return text;
    }
  }
  if(value&&typeof value==="object"){
    for(const key of ["text","response","output","result","value","data"]){
      const text=extractText(value[key]);
      if(text)return text;
    }
  }
  return undefined;
}

export async function generateViaNatlasSpace(
  question:string,
  groundedContext:unknown,
  language:SupportedLanguage,
  system:string
){
  const space=natlasLlmSpaceId();
  if(!space)throw new Error("N-ATLAS LLM Hugging Face Space is not configured. Set NATLAS_HF_LLM_SPACE.");

  const app=await connectWithRetry(space);
  const api:any=await app.view_api();
  const entries=Object.entries(api?.named_endpoints||{}) as [string,any][];
  const candidates=entries.filter(([,info])=>Array.isArray(info?.parameters)&&info.parameters.some((p:any)=>{
    const kind=textParamKind(p);
    return kind==="text"||kind==="history";
  }));
  if(!candidates.length)throw new Error(`N-ATLAS LLM Space ${space} exposes no usable text API endpoint.`);

  const [endpoint,info]=candidates[0];
  const fullPrompt=`${system}\n\nGROUNDED_CONTEXT:\n${JSON.stringify(groundedContext)}\n\nUSER_QUESTION:\n${question}`;
  let textUsed=false;
  const payload=(info.parameters||[]).map((p:any)=>{
    const kind=textParamKind(p);
    if(kind==="system")return system;
    if(kind==="history")return [];
    if(kind==="language")return speechLanguageFromUi(language);
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
