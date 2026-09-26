"use client";
import {useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

export default function LiteAsk(){
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(){
    if(question.trim().length<3)return;
    setBusy(true);
    try{
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question,language})});
      const d=await r.json();
      setAnswer(d.answer||d.error||"No answer available.");
    }finally{setBusy(false)}
  }

  return <main className="lite">
    <header><strong>ÌleraHer Lite</strong><a href="/">Full app</a></header>
    <h1>Ask by text on a low-data connection</h1>
    <p>Minimal interface for slower networks and basic smartphones.</p>
    <label>Language<select value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>{LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
    <label>Your question<textarea rows={4} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type a menstrual-health question"/></label>
    <button className="btn" onClick={submit} disabled={busy}>{busy?"Checking…":"Ask Ìlera"}</button>
    {answer&&<article className="liteAnswer">{answer}</article>}
    <small>Educational health guidance only. A qualified healthcare professional should confirm suspected conditions.</small>
  </main>
}
