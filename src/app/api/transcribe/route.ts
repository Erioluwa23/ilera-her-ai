import {NatlasProvider,speechConfigured,languages,MAX_AUDIO_BYTES,type SupportedLanguage} from '@/lib/natlas';
import {guard,json,readBounded} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 const rejected=guard(req,'voice');if(rejected)return rejected;
 if(!speechConfigured())return json({error:'Live N-ATLAS transcription is not enabled. You can record privately, replay it, or type your notes.'},503);
 const type=req.headers.get('content-type')||'';
 if(!type.startsWith('multipart/form-data'))return json({error:'Audio form data is required.'},415);
 let data:FormData;
 try {const bytes=await readBounded(req,MAX_AUDIO_BYTES+32_768);data=await new Request(req.url,{method:'POST',headers:{'content-type':type},body:bytes}).formData();} catch {return json({error:'The upload is invalid or exceeds 5 MB.'},413);}
 const audio=data.get('audio');const language=data.get('language');
 if(data.get('consent')!=='true')return json({error:'Explicit consent is required to send audio for transcription.'},400);
 if(!(audio instanceof Blob)||audio.size===0||audio.size>MAX_AUDIO_BYTES)return json({error:'Provide an audio file under 5 MB.'},400);
 if(!['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'].includes(audio.type.split(';')[0]))return json({error:'Unsupported audio format.'},415);
 if(!languages.includes(language as SupportedLanguage))return json({error:'Unsupported language.'},400);
 try{return json(await new NatlasProvider().transcribe(audio,language as SupportedLanguage));} catch {return json({error:'Transcription failed or timed out. Your recording was not saved by this application. Please try again or use text.'},502);}
}
