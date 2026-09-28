import {answerQuestion,evidenceFor,localizeHealthAnswer} from "@/lib/knowledge";
import {normalizeLanguage} from "@/lib/languages";
import {huggingFaceToken,NatlasLLMProvider} from "@/lib/natlas";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body||typeof body.question!=="string"||body.question.trim().length<3){
      return Response.json({error:"Please enter a menstrual-health question."},{status:400});
    }
    const question=body.question.trim().slice(0,1200);
    const language=normalizeLanguage(typeof body.language==="string"?body.language:"en-NG");
    const grounded=answerQuestion(question,language);
    const canTryHostedInference=Boolean(process.env.NATLAS_LLM_API_URL||huggingFaceToken());

    if(canTryHostedInference){
      try{
        const generated=await new NatlasLLMProvider().answer(question,evidenceFor(grounded),language);
        return Response.json({
          ...localizeHealthAnswer(grounded,language),
          answer:generated.text,
          language,
          model:generated.natlas?"n-atlas":"hf-fallback",
          generationModel:generated.model,
          generationProvider:generated.provider
        });
      }catch(error){
        console.error("Hosted LLM fallback:",error);
      }
    }

    return Response.json({
      ...localizeHealthAnswer(grounded,language),
      language,
      model:"curated",
      generationModel:null,
      generationProvider:"curated"
    });
  }catch{
    return Response.json({error:"Invalid request."},{status:400});
  }
}
