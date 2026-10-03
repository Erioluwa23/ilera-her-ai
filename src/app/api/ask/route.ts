import {answerQuestion,evidenceFor,localizeHealthAnswer} from "@/lib/knowledge";
import {normalizeLanguage} from "@/lib/languages";
import {NatlasLLMProvider} from "@/lib/natlas";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body||typeof body.question!=="string"||body.question.trim().length<3){
      return Response.json({error:"Please enter a menstrual-health question."},{status:400});
    }
    const question=body.question.trim().slice(0,1200);
    const language=normalizeLanguage(typeof body.language==="string"?body.language:"en-NG");
    const grounded=answerQuestion(question,language);


    try{
      const generated=await new NatlasLLMProvider().answer(question,evidenceFor(grounded),language);
      return Response.json({
        ...localizeHealthAnswer(grounded,language),
        answer:generated.text,
        language,
        model:"n-atlas",
        generationModel:generated.model,
        generationProvider:generated.provider
      });
    }catch(error){
      const message=error instanceof Error?error.message:"N-ATLAS inference failed.";
      console.error("N-ATLAS LLM:",error);
      return Response.json({error:message,language,model:"n-atlas-unavailable"},{status:503});
    }
  }catch{
    return Response.json({error:"Invalid request."},{status:400});
  }
}
