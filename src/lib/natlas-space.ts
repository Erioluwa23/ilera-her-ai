import {Client} from "@gradio/client";
import type {SupportedLanguage} from "@/lib/natlas";

const LANGUAGE_LABELS:Record<SupportedLanguage,string>={
  "en-NG":"Nigerian English",
  yo:"Yoruba",
  ha:"Hausa",
  ig:"Igbo"
};

const DEFAULT_SPACES:Record<SupportedLanguage,string>={
  "en-NG":"panamabananaman/NCAIR-Audio-Demo",
  yo:"ayscript/NCAIR-Yoruba",
  ha:"DevEmmy/scriptflow-hausa",
  ig:"panamabananaman/igbo-asr"
};

export function natlasSpaceId(language:SupportedLanguage){
  const configured:Record<SupportedLanguage,string|undefined>={
    "en-NG":process.env.NATLAS_HF_SPACE_EN_NG,
    yo:process.env.NATLAS_HF_SPACE_YO,
    ha:process.env.NATLAS_HF_SPACE_HA,
    ig:process.env.NATLAS_HF_SPACE_IG
  };
  return configured[language]||process.env.NATLAS_HF_SPACE||DEFAULT_SPACES[language];
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

async function connect(language:SupportedLanguage){
  return Client.connect(natlasSpaceId(language));
}

export async function inspectNatlasSpace(language:SupportedLanguage){
  const app=await connect(language);
  const api:any=await app.view_api();
  const named=api?.named_endpoints||{};
  return {
    space:natlasSpaceId(language),
    endpoints:Object.entries(named).map(([name,info]:[string,any])=>({
      name,
      parameters:(info?.parameters||[]).map((p:any)=>({
        label:p?.label??p?.parameter_name??null,
        component:p?.component??null,
        type:p?.type??p?.python_type?.type??null
      }))
    }))
  };
}

export async function transcribeViaNatlasSpace(audio:Blob,language:SupportedLanguage){
  const app=await connect(language);
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

  if(!candidates.length){
    throw new Error(`N-ATLAS Space ${natlasSpaceId(language)} exposes no audio API endpoint.`);
  }

  const [endpoint,info]=candidates[0];
  const payload=(info.parameters||[]).map((p:any)=>{
    if(isAudioParam(p))return audio;
    if(isLanguageParam(p))return LANGUAGE_LABELS[language];
    if(p?.parameter_has_default)return p?.parameter_default;
    return null;
  });

  const result:any=await app.predict(endpoint,payload);
  const text=extractText(result?.data);
  if(!text)throw new Error("N-ATLAS Space returned no transcription text.");
  return {text,endpoint,space:natlasSpaceId(language)};
}
