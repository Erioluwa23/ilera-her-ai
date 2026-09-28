import {Client,handle_file} from "@gradio/client";
import type {SupportedLanguage} from "@/lib/natlas";

const LANGUAGE_LABELS:Record<SupportedLanguage,string>={
  "en-NG":"Nigerian English",
  yo:"Yoruba",
  ha:"Hausa",
  ig:"Igbo"
};

function token(){
  return process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY||process.env.HUGGINGFACE_TOKEN;
}

export function natlasSpaceId(){
  return process.env.NATLAS_HF_SPACE||"KoladeOdunope/ednai-natlas-runtime";
}

export async function inspectNatlasSpace(){
  const app=await Client.connect(natlasSpaceId(),token()?{token:token()!}:undefined);
  return await app.view_api();
}

function isAudioParam(p:any){
  const c=String(p?.component||"").toLowerCase();
  const t=String(p?.type||p?.python_type?.type||"").toLowerCase();
  const n=String(p?.parameter_name||p?.label||"").toLowerCase();
  return c.includes("audio")||t.includes("filepath")||t.includes("audio")||n.includes("audio");
}

function isLanguageParam(p:any){
  const n=String(p?.parameter_name||p?.label||"").toLowerCase();
  return n.includes("language")||n==="lang";
}

function extractText(value:any):string|undefined{
  if(typeof value==="string"&&value.trim())return value.trim();
  if(Array.isArray(value)){
    for(const x of value){
      const t=extractText(x);
      if(t)return t;
    }
  }
  if(value&&typeof value==="object"){
    for(const key of ["text","transcription","transcript","output","result","value","data"]){
      const t=extractText(value[key]);
      if(t)return t;
    }
  }
  return undefined;
}

export async function transcribeViaNatlasSpace(audio:Blob,language:SupportedLanguage){
  const app=await Client.connect(natlasSpaceId(),token()?{token:token()!}:undefined);
  const api:any=await app.view_api();
  const entries=Object.entries(api?.named_endpoints||{}) as [string,any][];
  const candidates=entries
    .filter(([,info])=>Array.isArray(info?.parameters)&&info.parameters.some(isAudioParam))
    .sort((a,b)=>{
      const ar=(a[1].parameters||[]).filter((p:any)=>!p?.parameter_has_default&&!isAudioParam(p)&&!isLanguageParam(p)).length;
      const br=(b[1].parameters||[]).filter((p:any)=>!p?.parameter_has_default&&!isAudioParam(p)&&!isLanguageParam(p)).length;
      return ar-br;
    });

  if(!candidates.length)throw new Error("The configured N-ATLAS Hugging Face Space exposes no audio API endpoint.");

  const [endpoint,info]=candidates[0];
  const payload=(info.parameters||[]).map((p:any)=>{
    if(isAudioParam(p))return handle_file(audio);
    if(isLanguageParam(p))return LANGUAGE_LABELS[language];
    if(p?.parameter_has_default)return p?.parameter_default;
    return null;
  });

  const result:any=await app.predict(endpoint,payload);
  const text=extractText(result?.data);
  if(!text)throw new Error("N-ATLAS Space returned no transcription text.");
  return {text,endpoint,space:natlasSpaceId()};
}
