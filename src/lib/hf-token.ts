import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";

export function huggingFaceToken(){
  const fromEnv=process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY||process.env.HUGGINGFACE_TOKEN;
  if(fromEnv?.trim())return fromEnv.trim();

  const secretFileCandidates=[
    "/etc/secrets/HF_TOKEN",
    join(process.cwd(),"HF_TOKEN")
  ];

  for(const filePath of secretFileCandidates){
    try{
      if(existsSync(/* turbopackIgnore: true */ filePath)){
        const value=readFileSync(/* turbopackIgnore: true */ filePath,"utf8").trim();
        if(value)return value;
      }
    }catch{}
  }

  return undefined;
}
