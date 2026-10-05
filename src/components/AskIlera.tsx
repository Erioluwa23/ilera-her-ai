"use client";
import {useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

type Source={title:string;organization:string;url:string};
type Result={
  answer:string;
  possibleCauses:string[];
  nextSteps:string[];
  urgency:"routine"|"attention"|"urgent";
  disclaimer:string;
  sources:Source[];
  model:"n-atlas"|"n-atlas-unavailable";
  language?:string;
  generationModel?:string|null;
  generationProvider?:string;
};

export default function AskIlera(){
  const [q,setQ]=useState("");
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function ask(){
    if(busy || q.trim().length<3)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q,language})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not answer");
      setResult(d);
    }catch(e){
      setError(e instanceof Error?e.message:"Could not answer");
    }finally{setBusy(false)}
  }

  const engine=result?.model==="n-atlas"?"N-ATLAS":"N-ATLAS unavailable";

  return <section className="panel" id="ask">
    <span className="eyebrow">Ask Ìlera</span>
    <h2>Prefer to type?</h2>
    <p className="muted">Ask about your period in the language you feel comfortable using.</p>
    <label className="voiceLanguage">Response language
      <select disabled={busy} value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>
        {LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}
      </select>
    </label>
    <div className="askrow">
      <input aria-label="Menstrual health question" placeholder="e.g. My cramps feel stronger this month." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()}/>
      <button className="btn" onClick={ask} disabled={busy || q.trim().length < 3}>{busy?"Checking…":"Send question →"}</button>
    </div>
    {error&&<div className="risk urgent">{error}</div>}
    {result&&<div className="answer">
      <p><strong>{result.answer}</strong></p>
      {result.possibleCauses.length>0&&<><h4>Possible causes</h4><ul>{result.possibleCauses.map((x,i)=><li key={i}>{x}</li>)}</ul></>}
      <h4>What to do next</h4>
      <ul>{result.nextSteps.map((x,i)=><li key={i}>{x}</li>)}</ul>
      <div className={"risk "+result.urgency}><strong>Urgency: {result.urgency}</strong></div>
      <p className="disclaimer">{result.disclaimer}</p>
      <div className="sources"><strong>Sources</strong>{result.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.organization}: {s.title}</a>)}</div>
      <small>Response engine: {engine}</small>
    </div>}
  </section>;
}
