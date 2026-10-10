import {Client,handle_file} from "@gradio/client";
import {huggingFaceToken} from "@/lib/hf-token";
import {AsrError,validateAudio} from "@/lib/asr-contract";
import type {SupportedLanguage} from "@/lib/natlas";
import {NATLAS_ASR_MODELS,speechLanguageFromUi} from "@/lib/languages";

const verifiedLanguages=new Set<string>();
const ILERAHER_ASR_SPACE="Kolade1/ileraHer-natlas-runtime";

export function natlasSpaceId(){
  return ILERAHER_ASR_SPACE;
}

export function natlasLlmSpaceId(){
  return process.env.NATLAS_HF_LLM_SPACE?.trim()||ILERAHER_ASR_SPACE;
}

function clientOptions(){
  const token=huggingFaceToken();
  if(token&&!token.startsWith("hf_"))throw new AsrError("ASR_AUTH",503,"Invalid server Hugging Face credential format.");
  // submit() reports only data by default. Subscribe to status so queued
  // failures (including GPU quota) cannot disappear as an empty transcription.
  const events: ("data"|"status")[]=["data","status"];
  return token?{token:token as `hf_${string}`,events,record_history:false}:{events,record_history:false};
}

export function classifyAsrError(error:unknown):AsrError{
  if(error instanceof AsrError)return error;
  const detail=error && typeof error==="object" && "message" in error ? (error as {message:unknown}).message : error;
  const message=String(detail).toLowerCase();
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
    let generation:Record<string,unknown>={llmLoaded:false,ttsLoaded:false};
    if(api.named_endpoints?.["/status"]){
      const result=await app.predict("/status",[]);
      let status:unknown=Array.isArray(result.data)?result.data[0]:result.data;
      if(typeof status==="string"){try{status=JSON.parse(status)}catch{status=null}}
      if(status&&typeof status==="object"){
        const verified=status as Record<string,unknown>;
        gatedModelsAccessible=verified.provider==="ileraher_zerogpu_asr"&&verified.gatedModelsAccessible===true;
        modelsLoaded=verified.modelsLoaded===true;
        generation={llmLoaded:verified.llmLoaded===true,ttsLoaded:verified.ttsLoaded===true,
          llmAccess:typeof verified.llmAccess==="boolean"?verified.llmAccess:null,
          llmFailureCategory:["access","load"].includes(String(verified.llmFailureCategory))?verified.llmFailureCategory:null,
          llmError:verified.llmError,ttsError:verified.ttsError,ttsStage:verified.ttsStage};
      }
    }
    const inferenceTested=verifiedLanguages.size===4;
    return {space:natlasSpaceId(),sdk:info.sdk,stage:info.runtime?.stage,reachable,gatedModelsAccessible,modelsLoaded,inferenceTested,verifiedLanguages:[...verifiedLanguages],...generation,ready:reachable&&gatedModelsAccessible&&modelsLoaded&&inferenceTested};
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

function structured(value:unknown):Record<string,unknown>{
  if(typeof value==="string") value=JSON.parse(value);
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid model response");
  return value as Record<string,unknown>;
}

export async function generateViaNatlasSpace(question:string,groundedContext:unknown,language:SupportedLanguage,system:string,signal?:AbortSignal){
  return withAsrClient(async app=>{
    const result=await app.predict("/answer",[question,JSON.stringify(groundedContext),speechLanguageFromUi(language),system]);
    const data=structured((result.data as unknown[])[0]);
    if(data.model!=="NCAIR1/N-ATLaS"||data.provider!=="ileraher_zerogpu_llm"||data.language!==speechLanguageFromUi(language)||typeof data.text!=="string"||!data.text.trim())throw new Error("N-ATLaS answer verification failed");
    return {text:data.text.trim(),endpoint:"/answer",space:natlasSpaceId()};
  },signal,120000);
}

export function verifiedAudioUrl(value:unknown){
  if(typeof value!=="string")throw new Error("Missing reply audio");
  const url=new URL(value);
  if(url.origin!=="https://kolade1-ileraher-natlas-runtime.hf.space"||url.username||url.password||!url.pathname.startsWith("/gradio_api/file="))throw new Error("Untrusted reply audio location");
  return url;
}

export async function synthesizeViaYarnSpace(text:string,language:SupportedLanguage,signal?:AbortSignal){
  return withAsrClient(async(app,abortSignal)=>{
    const result=await app.predict("/synthesize",[text,speechLanguageFromUi(language)]);
    const values=result.data as unknown[];
    const provenance=structured(values[1]);
    if(provenance.model!=="saheedniyi/YarnGPT2b"||provenance.provider!=="ileraher_zerogpu_tts"||provenance.language!==speechLanguageFromUi(language))throw new Error("YarnGPT audio verification failed");
    const file=structured(values[0]);
    const url=verifiedAudioUrl(file.url);
    const token=huggingFaceToken();
    const response=await fetch(url,{redirect:"error",signal:abortSignal,headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok||!response.body)throw new Error("Reply audio unavailable");
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];
    let bytes=0;
    while(true){
      const next=await reader.read();if(next.done)break;
      bytes+=next.value.byteLength;
      if(bytes>4*1024*1024){await reader.cancel();throw new Error("Reply audio too large")}
      chunks.push(next.value);
    }
    const buffer=Buffer.concat(chunks);
    if(buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE")throw new Error("Invalid reply audio format");
    return buffer;
  },signal,180000);
}
