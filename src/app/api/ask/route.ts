import {answerQuestion,evidenceFor,localizeHealthAnswer} from "@/lib/knowledge";
import {normalizeLanguage} from "@/lib/languages";
import {NatlasLLMProvider} from "@/lib/natlas";
import {parseConversation} from "@/lib/voice-chat";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body||typeof body.question!=="string"||body.question.trim().length<3){
      return Response.json({error:"Please enter a menstrual-health question."},{status:400});
    }
    const question=body.question.trim().slice(0,1200);
    const language=normalizeLanguage(typeof body.language==="string"?body.language:"en-NG");
    const conversation=parseConversation(body.conversation);
    const reported=conversation.filter(turn=>turn.role==="user").map(turn=>turn.content);
    const current=answerQuestion(question,language);
    const candidates=[...reported.map(text=>answerQuestion(text,language)),current];
    const combined=reported.map(text=>answerQuestion(`${text}\n${question}`,language));
    // A short follow-up keeps its parent's topic; prior urgent symptoms are never silently downgraded.
    const grounded=[...candidates,...combined].find(answer=>answer.urgency==="urgent") ||
      (current.topic!=="unknown" ? current : [...candidates].reverse().find(answer=>answer.topic!=="unknown") || current);
    const localized=localizeHealthAnswer(grounded,language);

    try{
      if(grounded.urgency==="urgent") throw new Error("Preserving source-grounded urgent guidance");
      const generated=await new NatlasLLMProvider().answer(question,{
        ...evidenceFor(grounded),conversation,
      },language);
      return Response.json({
        ...localized,
        answer:generated.text,
        language,
        model:"n-atlas",
        natlasAvailable:true,
        generationModel:generated.model,
        generationProvider:generated.provider
      });
    }catch(error){
      const message=error instanceof Error?error.message:"N-ATLAS inference failed.";
      console.warn("N-ATLAS guidance unavailable; using source-grounded response");
      return Response.json({
        ...localized,
        language,
        model:"curated",
        natlasAvailable:false,
        natlasError:message,
        generationModel:null,
        generationProvider:"curated"
      });
    }
  }catch{
    return Response.json({error:"Invalid request."},{status:400});
  }
}
