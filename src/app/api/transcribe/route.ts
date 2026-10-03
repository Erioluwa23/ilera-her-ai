import {NatlasSpeechProvider,SupportedLanguage} from "@/lib/natlas";
import {normalizeLanguage} from "@/lib/languages";

const MAX_AUDIO_BYTES=25*1024*1024;

export async function POST(req:Request){
  try{
    const data=await req.formData();
    const audio=data.get("audio")??data.get("file");
    if(!(audio instanceof Blob))return Response.json({error:"Audio is required."},{status:400});
    if(audio.size>MAX_AUDIO_BYTES)return Response.json({error:"Audio file exceeds the 25 MB limit."},{status:413});

    const language=normalizeLanguage(String(data.get("language")||"en-NG")) as SupportedLanguage;
    const started=Date.now();
    const result=await new NatlasSpeechProvider().transcribe(audio,language);

    return Response.json({
      ...result,
      latency_ms:Date.now()-started
    });
  }catch(error){
    const message=error instanceof Error?error.message:"Transcription could not be completed.";
    const status=message.includes("not configured")?503:502;
    return Response.json({error:message},{status});
  }
}
