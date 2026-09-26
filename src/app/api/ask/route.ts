import {answerQuestion,evidenceFor} from "@/lib/knowledge";
import {NatlasLLMProvider} from "@/lib/natlas";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body||typeof body.question!=="string"||body.question.trim().length<3){
      return Response.json({error:"Please enter a menstrual-health question."},{status:400});
    }
    const question=body.question.trim().slice(0,1200);
    const grounded=answerQuestion(question);
    if(process.env.NATLAS_LLM_API_URL){
      try{
        const answer=await new NatlasLLMProvider().answer(question,evidenceFor(grounded));
        return Response.json({...grounded,answer,model:"n-atlas"});
      }catch(error){
        console.error("N-ATLAS LLM fallback:",error);
      }
    }
    return Response.json(grounded);
  }catch{
    return Response.json({error:"Invalid request."},{status:400});
  }
}
