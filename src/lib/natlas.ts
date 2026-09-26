export const languages=['en-NG','yo','ha','ig'] as const;
export type SupportedLanguage=typeof languages[number];
export type Transcript={text:string;language:SupportedLanguage;model?:string};
export const MAX_AUDIO_BYTES=5*1024*1024;
export function speechConfigured():boolean {return Boolean(process.env.NATLAS_API_URL&&process.env.NATLAS_API_KEY&&process.env.VOICE_BETA_ENABLED==='true');}
export function validateTranscript(value:unknown,language:SupportedLanguage):Transcript {
 if(!value||typeof value!=='object')throw new Error('Invalid transcript');
 const v=value as Record<string,unknown>;
 if(typeof v.text!=='string'||!v.text.trim()||v.text.length>4000)throw new Error('Invalid transcript');
 if(v.language!==undefined&&v.language!==language)throw new Error('Unexpected transcript language');
 return {text:v.text.trim(),language,model:typeof v.model==='string'?v.model.slice(0,100):undefined};
}
/** This is OUR documented inference-worker contract, not an assumed official N-ATLAS API. */
export class NatlasProvider {
 async transcribe(audio:Blob,language:SupportedLanguage='en-NG'):Promise<Transcript> {
  if(!speechConfigured())throw new Error('Speech not configured');
  if(audio.size===0||audio.size>MAX_AUDIO_BYTES)throw new Error('Invalid audio size');
  const url=new URL(process.env.NATLAS_API_URL!);
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('HTTPS endpoint required');
  const form=new FormData();form.append('audio',audio,'recording.webm');form.append('language',language);
  const res=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.NATLAS_API_KEY}`},body:form,redirect:'error',signal:AbortSignal.timeout(25_000),cache:'no-store'});
  if(!res.ok)throw new Error('Speech provider unavailable');
  const reader=res.body?.getReader();if(!reader)throw new Error('Empty provider response');
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32_000){await reader.cancel();throw new Error('Provider response too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return validateTranscript(JSON.parse(new TextDecoder().decode(data)),language);
 }
}
