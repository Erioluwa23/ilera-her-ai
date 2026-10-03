export async function register(){
  if(process.env.NEXT_RUNTIME!=="nodejs")return;
  const space=process.env.NATLAS_HF_SPACE?.trim();
  if(!space){
    console.error("[ASR startup check] NATLAS_HF_SPACE is not configured.");
    return;
  }
  try{
    const {inspectNatlasSpace}=await import("@/lib/natlas-space");
    const result=await inspectNatlasSpace();
    console.log("[ASR startup check] Hugging Face Space reachable:",JSON.stringify(result));
  }catch(error){
    console.error("[ASR startup check] Hugging Face Space unavailable:",error instanceof Error?error.message:String(error));
  }
}
