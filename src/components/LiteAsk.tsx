"use client";
import {useRef,useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

const SPEECH_LANG:Record<IlaraLanguage,string>={"en-NG":"en-NG",yo:"yo-NG",ha:"ha-NG",ig:"ig-NG"};

export default function LiteAsk(){
  const rec=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [recording,setRecording]=useState(false);

  function speak(text:string){
    if(typeof window==="undefined"||!("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=SPEECH_LANG[language];
    u.rate=.95;
    window.speechSynthesis.speak(u);
  }

  async function ask(text:string){
    if(text.trim().length<3)return;
    setBusy(true);setStatus("");
    try{
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:text,language})});
      const d=await r.json();
      const value=d.answer||d.error||"No answer available.";
      setAnswer(value);
      if(r.ok)speak(value);
    }finally{setBusy(false)}
  }

  async function startVoice(){
    try{
      setAnswer("");setStatus("");
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current=[];
      const recorder=new MediaRecorder(stream);
      rec.current=recorder;
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data)};
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);setStatus("Transcribing…");
        const data=new FormData();
        data.append("audio",new Blob(chunks.current,{type:recorder.mimeType}),"voice.webm");
        data.append("language",language);
        try{
          const r=await fetch("/api/transcribe",{method:"POST",body:data});
          const d=await r.json();
          if(!r.ok)throw new Error(d.error||"Transcription failed");
          setQuestion(d.text);
          setStatus("");
          await ask(d.text);
        }catch(e){setStatus(e instanceof Error?e.message:"Voice unavailable.")}
      };
      recorder.start();setRecording(true);
    }catch{setStatus("Microphone unavailable. Type your question below.")}
  }

  return <main className="lite liteVoice">
    <header><strong>ÌleraHer Lite</strong><a href="/">Full app</a></header>
    <div>
      <span className="eyebrow">Low-bandwidth voice mode</span>
      <h1>Speak first. Type only if you need to.</h1>
      <p>Minimal mobile interface with the same four-language N-ATLAS voice path.</p>
    </div>
    <label>Language<select value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>{LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
    <button className={recording?"liteMic recording":"liteMic"} type="button" onClick={recording?()=>rec.current?.stop():startVoice}>{recording?"■ Stop and send":"🎙️ Tap to speak"}</button>
    {status&&<p className="liteStatus">{status}</p>}
    <details>
      <summary>Prefer to type?</summary>
      <label>Your question<textarea rows={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type a menstrual-health question"/></label>
      <button className="btn" onClick={()=>ask(question)} disabled={busy}>{busy?"Checking…":"Ask Ìlera"}</button>
    </details>
    {answer&&<article className="liteAnswer"><p>{answer}</p><button className="secondaryBtn" type="button" onClick={()=>speak(answer)}>🔊 Hear response</button></article>}
    <small>Educational health guidance only. A qualified healthcare professional should confirm suspected conditions.</small>
  </main>;
}
