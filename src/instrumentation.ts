export async function register(){
  if(process.env.NEXT_RUNTIME!=="nodejs")return;
  try{
    const {inspectNatlasSpace}=await import("@/lib/natlas-space");
    const result=await inspectNatlasSpace();
    console.info("[ASR startup check]",JSON.stringify({space:result.space,sdk:result.sdk,reachable:result.reachable,ready:result.ready}));
  }catch{console.info("[ASR startup check] Runtime readiness could not be verified.")}
}
