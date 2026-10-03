import {Client,handle_file} from "@gradio/client";
import {huggingFaceToken} from "@/lib/hf-token";
import {AsrError,validateAudio} from "@/lib/asr-contract";
import type {SupportedLanguage} from "@/lib/natlas";
import {NATLAS_ASR_MODELS,speechLanguageFromUi} from "@/lib/languages";

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const verifiedLanguages=new Set<string>();
const ILERAHER_ASR_SPACE="Erioluwa24/ileraher-natlas-runtime";

export function natlasSpaceId(){
  return ILERAHER_ASR_SPACE;
}

export function natlasLlmSpaceId(){
  return process.env.NATLAS_HF_LLM_SPACE?.trim()||null;
}

function clientOptions(){
  const token=huggingFaceToken();
  if(token&&!token.startsWith("hf_"))throw new AsrError("ASR_AUTH",503,"Invalid server Hugging Face credential format.");
  return token?{token:token as `hf_${string}`,record_history:false}:{record_history:false};
}

async function connectWithRetry(space:string){
  // LLM connection behavior remains separate from ASR.
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{return await Client.connect(space,clientOptions())}catch(error){
      lastError=error;if(attempt<2)await sleep(attempt===0?2500:7000);
    }
  }
  throw lastError;
}

export function classifyAsrError(error:unknown):AsrError{
  if(error instanceof AsrError)return error;
  const message=String(error instanceof Error?error.message:error).toLowerCase();
  if(/401|403|unauthorized|forbidden|credential|gated/.test(message))return new AsrError("ASR_AUTH",503,"ASR runtime or model access is not authorized.");
  if(/quota|429|rate limit/.test(message))return new AsrError("ASR_QUOTA",429,"ASR compute quota is exhausted. Please try later.");
  if(/building|starting|sleeping|no app|not found|404/.test(message))return new AsrError("ASR_STARTING",503,"ASR compute runtime is not ready.");
  return new AsrError("ASR_UPSTREAM",502,"ASR runtime could not complete transcription.");
}

export function parseAsrResponse(value:unknown,language:SupportedLanguage){
  if(Array.isArray(value)&&value.length===1)value=value[0];
  if(typeof value==="string"){
    try{value=JSON.parse(value)}catch{throw new AsrError("ASR_PROVENANCE",502,"ASR returned malformed JSON.")}
  }
  if(!value||typeof value!=="object"||Array.isArray(value))throw new AsrError("ASR_PROVENANCE",502,"ASR returned an invalid response.");
  const payload=value as Record<string,unknown>;
  const expectedLanguage=speechLanguageFromUi(language);
  if(payload.model!==NATLAS_ASR_MODELS[language]||payload.language!==expectedLanguage||payload.provider!=="ileraher_zerogpu_asr"){
    throw new AsrError("ASR_PROVENANCE",502,"ASR model, language or provider verification failed.");
  }
  if(typeof payload.text!=="string"||!payload.text.trim())throw new AsrError("ASR_EMPTY",502,"ASR returned no usable transcription.");
  return {text:payload.text.trim(),model:payload.model as string,language:expectedLanguage,provider:payload.provider as string,space:natlasSpaceId()};
}

async function withAsrClient<T>(operation:(app:Client,signal:AbortSignal)=>Promise<T>,signal?:AbortSignal,timeoutMs=90000):Promise<T>{
  const controller=new AbortController();
  let app:Client|undefined;
  const cancel=()=>controller.abort(signal?.reason);
  signal?.addEventListener("abort",cancel,{once:true});
  if(signal?.aborted)cancel();
  const timer=setTimeout(()=>controller.abort(new AsrError("ASR_TIMEOUT",504,"ASR runtime timed out.")),timeoutMs);
  let rejectAbort:(e:unknown)=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject});
  const onAbort=()=>{app?.close();rejectAbort(controller.signal.reason instanceof AsrError?controller.signal.reason:new AsrError("ASR_CANCELLED",499,"Transcription cancelled."))};
  controller.signal.addEventListener("abort",onAbort,{once:true});
  const task=(async()=>{
    if(controller.signal.aborted)throw new AsrError("ASR_CANCELLED",499,"Transcription cancelled.");
    app=await Client.connect(natlasSpaceId(),clientOptions());
    if(controller.signal.aborted){app.close();throw controller.signal.reason}
    const clientFetch=app.fetch.bind(app);
    app.fetch=(input,init)=>clientFetch(input,{...init,signal:controller.signal});
    return operation(app,controller.signal);
  })();
  try{return await Promise.race([task,aborted])}catch(error){throw classifyAsrError(error)}finally{
    clearTimeout(timer);signal?.removeEventListener("abort",cancel);controller.signal.removeEventListener("abort",onAbort);app?.close();
  }
}

export async function inspectNatlasSpace(){
  const metadata=await fetch(`https://huggingface.co/api/spaces/${natlasSpaceId()}`,{cache:"no-store",signal:AbortSignal.timeout(8000),headers:huggingFaceToken()?{Authorization:`Bearer ${huggingFaceToken()}`}:{}});
  if(!metadata.ok)throw new AsrError("ASR_STARTING",503,"ASR Space metadata is unavailable.");
  const info=await metadata.json();
  if(info.sdk!=="gradio")return {space:natlasSpaceId(),sdk:info.sdk,stage:info.runtime?.stage,reachable:false,gatedModelsAccessible:false,inferenceTested:false,ready:false};
  return withAsrClient(async app=>{
    const api=await app.view_api();
    const reachable=Boolean(api.named_endpoints?.["/transcribe"]);
    let gatedModelsAccessible=false,modelsLoaded=false;
    if(api.named_endpoints?.["/status"]){
      const result=await app.predict("/status",[]);
      const status=Array.isArray(result.data)?result.data[0]:result.data;
      if(status&&typeof status==="object"){
        const verified=status as Record<string,unknown>;
        gatedModelsAccessible=verified.provider==="ileraher_zerogpu_asr"&&verified.gatedModelsAccessible===true;
        modelsLoaded=verified.modelsLoaded===true;
      }
    }
    const inferenceTested=verifiedLanguages.size===4;
    return {space:natlasSpaceId(),sdk:info.sdk,stage:info.runtime?.stage,reachable,gatedModelsAccessible,modelsLoaded,inferenceTested,verifiedLanguages:[...verifiedLanguages],ready:reachable&&gatedModelsAccessible&&modelsLoaded&&inferenceTested};
  },undefined,8000);
}

export async function transcribeViaNatlasSpace(audio:Blob,language:SupportedLanguage,signal?:AbortSignal){
  await validateAudio(audio);
  return withAsrClient(async(app,abortSignal)=>{
    const job=app.submit("/transcribe",[handle_file(audio),speechLanguageFromUi(language)]);
    const cancel=()=>{void job.cancel().catch(()=>{});job.close_stream()};
    abortSignal.addEventListener("abort",cancel,{once:true});
    try{
      for await(const event of job){
        if(event.type==="data"){
          const response=parseAsrResponse(event.data,language);verifiedLanguages.add(response.language);return response;
        }
        if(event.type==="status"&&event.stage==="error")throw new Error(String(event.message||event.code||"Upstream failure"));
      }
      throw new AsrError("ASR_EMPTY",502,"ASR returned no result.");
    }finally{abortSignal.removeEventListener("abort",cancel);job.close_stream()}
  },signal);
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
