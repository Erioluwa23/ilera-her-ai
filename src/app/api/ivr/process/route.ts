import {twiml,xmlEscape} from "@/lib/ivr";
import {answerQuestion,evidenceFor} from "@/lib/knowledge";
import {normalizeLanguage} from "@/lib/languages";
import {NatlasLLMProvider,NatlasSpeechProvider} from "@/lib/natlas";

function authHeader():Record<string,string>{
  const sid=process.env.TWILIO_ACCOUNT_SID,token=process.env.TWILIO_AUTH_TOKEN;
  if(!sid||!token)return {};
  return {Authorization:"Basic "+Buffer.from(sid+":"+token).toString("base64")};
}

export async function POST(req:Request){
  try{
    const url=new URL(req.url);
    const language=normalizeLanguage(url.searchParams.get("language"));
    const form=await req.formData();
    const recordingUrl=String(form.get("RecordingUrl")||"");
    if(!recordingUrl)return twiml("<Say>We could not access your recording. Please try again.</Say>");

    const audioRes=await fetch(recordingUrl+".wav",{headers:authHeader()});
    if(!audioRes.ok)return twiml("<Say>We could not retrieve your recording. Please try again later.</Say>");
    const audio=await audioRes.blob();

    const transcript=await new NatlasSpeechProvider().transcribe(audio,language);
    const grounded=answerQuestion(transcript.text,language);
    let answer=grounded.answer;
    if(process.env.NATLAS_LLM_API_URL){
      try{
        const generated=await new NatlasLLMProvider().answer(transcript.text,evidenceFor(grounded),language);
        answer=generated.text;
      }catch{}
    }

    const spoken=xmlEscape(answer+" "+grounded.disclaimer);
    return twiml("<Say>"+spoken+"</Say><Hangup/>");
  }catch{
    return twiml("<Say>We could not process your request. If your symptoms are severe or worrying, please seek medical care.</Say><Hangup/>");
  }
}

export const GET=POST;
