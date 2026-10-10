import {voiceAnswer} from "@/lib/voice-answer";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body||typeof body.question!=="string"||body.question.trim().length<3){
      return Response.json({error:"Please enter a menstrual-health question."},{status:400});
    }
    const question=body.question.trim().slice(0,1200);
    return Response.json(await voiceAnswer(question, typeof body.language==="string"?body.language:"en-NG", body.conversation, req.signal));
  }catch{
    return Response.json({error:"Invalid request."},{status:400});
  }
}
