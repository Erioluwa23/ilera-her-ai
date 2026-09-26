export type SupportedLanguage="en-NG"|"yo"|"ha"|"ig";
export type Transcript={text:string;language?:SupportedLanguage};
export interface SpeechProvider{transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>}
export class NatlasProvider implements SpeechProvider{
 async transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>{
  const url=process.env.NATLAS_API_URL,key=process.env.NATLAS_API_KEY;
  if(!url||!key)throw new Error("N-ATLAS is not configured");
  const body=new FormData();body.append("audio",audio);if(language)body.append("language",language);
  const res=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${key}`},body});
  if(!res.ok)throw new Error(`N-ATLAS request failed: ${res.status}`);
  const data=await res.json();if(!data||typeof data.text!=="string")throw new Error("Invalid N-ATLAS response");
  return data as Transcript;
 }
}