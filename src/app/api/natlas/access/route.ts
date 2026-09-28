import {huggingFaceToken} from "@/lib/natlas";

const MODELS=[
  "NCAIR1/N-ATLaS",
  "NCAIR1/NigerianAccentedEnglish",
  "NCAIR1/Yoruba-ASR",
  "NCAIR1/Hausa-ASR",
  "NCAIR1/Igbo-ASR"
];

export async function GET(){
  const key=huggingFaceToken();
  if(!key){
    return Response.json({ok:false,configured:false,error:"Hugging Face token is not configured on this service."},{status:503});
  }

  const results=await Promise.all(MODELS.map(async model=>{
    try{
      const r=await fetch("https://huggingface.co/api/models/"+encodeURIComponent(model),{
        headers:{Authorization:`Bearer ${key}`},
        cache:"no-store"
      });
      return {model,accessible:r.ok,status:r.status};
    }catch{
      return {model,accessible:false,status:0};
    }
  }));

  return Response.json({
    ok:results.every(x=>x.accessible),
    configured:true,
    models:results
  },{headers:{"cache-control":"no-store"}});
}
