"use client";
import {useState} from "react";

type Source={title:string;organization:string;url:string};
type Result={answer:string;possibleCauses:string[];nextSteps:string[];urgency:"routine"|"attention"|"urgent";disclaimer:string;sources:Source[];model:"curated"|"n-atlas"};

export default function AskIlera(){
  const [q,setQ]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function ask(){
    if(q.trim().length<3)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not answer");
      setResult(d);
    }catch(e){
      setError(e instanceof Error?e.message:"Could not answer");
    }finally{setBusy(false)}
  }

  return <section className="panel">
    <span className="eyebrow">Ask Ìlera</span>
    <h2>Ask a menstrual-health question directly</h2>
    <p className="muted">Answers are grounded in named medical sources. ÌleraHer can suggest possible causes and urgency, but a clinician must confirm a diagnosis.</p>
    <div className="askrow">
      <input aria-label="Menstrual health question" placeholder="e.g. How do I count my safe days?" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()}/>
      <button className="btn" onClick={ask} disabled={busy}>{busy?"Checking…":"Ask"}</button>
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
      <small>Response engine: {result.model==="n-atlas"?"N-ATLAS LLM + curated medical grounding":"Curated medical grounding (N-ATLAS LLM not configured)"}</small>
    </div>}
  </section>;
}