import {writeFile,unlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {NatlasSpeechProvider,SupportedLanguage} from "@/lib/natlas";
import {normalizeLanguage} from "@/lib/languages";

export const runtime="nodejs";
const MAX_AUDIO_BYTES=25*1024*1024;

function suffixFor(file:Blob&{name?:string}){
  const name=file.name||"";
  const dot=name.lastIndexOf(".");
  if(dot>=0&&dot<name.length-1)return name.slice(dot).replace(/[^.a-zA-Z0-9]/g,"").slice(0,10)||".webm";
  const type=file.type.toLowerCase();
  if(type.includes("wav"))return ".wav";
  if(type.includes("mpeg")||type.includes("mp3"))return ".mp3";
  if(type.includes("ogg"))return ".ogg";
  if(type.includes("mp4")||type.includes("m4a"))return ".m4a";
  return ".webm";
}

export async function POST(req:Request){
  let tempPath:string|undefined;
  try{
    const data=await req.formData();
    const audio=data.get("audio")??data.get("file");
    if(!(audio instanceof Blob))return Response.json({error:"Audio is required."},{status:400});
    if(audio.size>MAX_AUDIO_BYTES)return Response.json({error:"Audio file exceeds the 25 MB limit."},{status:413});

    const language=normalizeLanguage(String(data.get("language")||"en-NG")) as SupportedLanguage;
    tempPath=join(tmpdir(),`ileraher-${randomUUID()}${suffixFor(audio)}`);
    await writeFile(tempPath,Buffer.from(await audio.arrayBuffer()));

    const started=Date.now();
    const result=await new NatlasSpeechProvider().transcribeFile(tempPath,language);

    return Response.json({...result,latency_ms:Date.now()-started});
  }catch(error){
    const message=error instanceof Error?error.message:"Transcription could not be completed.";
    const status=message.includes("not configured")?503:502;
    return Response.json({error:message},{status});
  }finally{
    if(tempPath){
      try{await unlink(tempPath)}catch{}
    }
  }
}
