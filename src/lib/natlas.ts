export type SupportedLanguage="en-NG"|"yo"|"ha"|"ig";
export type Transcript={text:string;language?:SupportedLanguage};

export interface SpeechProvider{transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>}

export class NatlasSpeechProvider implements SpeechProvider{
 async transcribe(audio:Blob,language?:SupportedLanguage):Promise<Transcript>{
  const url=process.env.NATLAS_ASR_API_URL||process.env.NATLAS_API_URL;
  const key=process.env.NATLAS_ASR_API_KEY||process.env.NATLAS_API_KEY;
  if(!url)throw new Error("N-ATLAS ASR is not configured");
  const body=new FormData();body.append("audio",audio);if(language)body.append("language",language);
  const headers:Record<string,string>={};if(key)headers.Authorization=`Bearer ${key}`;
  const res=await fetch(url,{method:"POST",headers,body});
  if(!res.ok)throw new Error(`N-ATLAS ASR request failed: ${res.status}`);
  const data=await res.json();
  if(!data||typeof data.text!=="string")throw new Error("Invalid N-ATLAS ASR response");
  return data as Transcript;
 }
}

export class NatlasLLMProvider{
 async answer(question:string,groundedContext:unknown):Promise<string>{
  const url=process.env.NATLAS_LLM_API_URL;
  const key=process.env.NATLAS_LLM_API_KEY;
  const model=process.env.NATLAS_LLM_MODEL||"NCAIR1/N-ATLaS";
  if(!url)throw new Error("N-ATLAS LLM is not configured");
  const headers:Record<string,string>={"content-type":"application/json"};
  if(key)headers.Authorization=`Bearer ${key}`;
  const system=[
    "You are ÌleraHer, a menstrual-health education assistant for Nigerian users.",
    "Use ONLY the medically reviewed facts supplied in GROUNDED_CONTEXT.",
    "Answer the user's question directly before adding any explanation.",
    "Do not invent conditions, dosages, test results, probabilities, or source claims.",
    "You may describe possible causes but must never claim a confirmed diagnosis.",
    "Preserve the urgency level and safety instructions in the grounded context.",
    "Reply in the user's language when it is clearly English, Hausa, Igbo, or Yoruba.",
    "Keep the answer concise and understandable."
  ].join(" ");
  const res=await fetch(url,{method:"POST",headers,body:JSON.stringify({
    model,
    temperature:0.1,
    max_tokens:700,
    messages:[
      {role:"system",content:system},
      {role:"user",content:`GROUNDED_CONTEXT:\n${JSON.stringify(groundedContext)}\n\nUSER_QUESTION:\n${question}`}
    ]
  })});
  if(!res.ok)throw new Error(`N-ATLAS LLM request failed: ${res.status}`);
  const data=await res.json();
  const text=data?.choices?.[0]?.message?.content??data?.text??data?.generated_text;
  if(typeof text!=="string"||!text.trim())throw new Error("Invalid N-ATLAS LLM response");
  return text.trim();
 }
}

// Backwards-compatible export used by the existing transcription route.
export class NatlasProvider extends NatlasSpeechProvider{}
