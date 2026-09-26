export async function GET(){
  return Response.json({
    ok:true,
    service:"ileraher-ai",
    natlas:{
      asrConfigured:Boolean(process.env.NATLAS_ASR_API_URL||process.env.NATLAS_API_URL),
      llmConfigured:Boolean(process.env.NATLAS_LLM_API_URL),
      model:process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS"
    }
  });
}
