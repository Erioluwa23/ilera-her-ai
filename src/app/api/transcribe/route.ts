import {NatlasSpeechProvider,SupportedLanguage} from "@/lib/natlas";
import {normalizeLanguage} from "@/lib/languages";
export async function POST(req:Request){
  try{
    const data=await req.formData();
    const audio=data.get("audio");
    if(!(audio instanceof Blob))return Response.json({error:"Audio is required."},{status:400});
    const language=normalizeLanguage(String(data.get("language")||"en-NG")) as SupportedLanguage;
    const result=await new NatlasSpeechProvider().transcribe(audio,language);
    return Response.json(result);
  }catch(error){
    const message=error instanceof Error?error.message:"Transcription could not be completed.";
    const status=message.includes("not configured")?503:502;
    return Response.json({error:message},{status});
  }
}
