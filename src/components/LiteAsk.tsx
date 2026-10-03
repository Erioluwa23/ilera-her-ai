"use client";
import {useRef,useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

import {useVoiceRecording,speakResponse} from "@/lib/use-voice-recording";

export default function LiteAsk(){
  const voice=useVoiceRecording();
  const requesting=useRef(false);
  const [answerLanguage,setAnswerLanguage]=useState<IlaraLanguage>("en-NG");
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const {recording}=voice;

  function speak(text:string,code:IlaraLanguage){
    if(!speakResponse(text,code))setStatus("Speech playback for this language is unavailable on this device. Read the response below.");
  }
  async function ask(text:string,code:IlaraLanguage=language,signal?:AbortSignal){
    if(text.trim().length<3||requesting.current)return;
    requesting.current=true;setBusy(true);setStatus("");
    try{
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:text,language:code}),signal});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Health response failed");
      if(signal?.aborted)return;
      setAnswer(d.answer);setAnswerLanguage(code);speak(d.answer,code);
    }catch(error){if(!signal?.aborted)setStatus(error instanceof Error?error.message:"Health response failed.")}
    finally{requesting.current=false;setBusy(false)}
  }
  async function startVoice(){
    if(requesting.current)return;
    setAnswer("");setStatus("");
    await voice.start(language,async(audio,filename,code,signal)=>{
      setStatus("Transcribing…");
      const data=new FormData();data.append("audio",audio,filename);data.append("language",code);
      const r=await fetch("/api/transcribe",{method:"POST",body:data,signal});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Transcription failed");
      if(signal.aborted)return;
      setQuestion(d.text);setStatus("");await ask(d.text,code,signal);
    });
  }

  return <main className="lite liteVoice">
    <header><strong>ÌleraHer Lite</strong><a href="/">Full app</a></header>
    <div>
      <span className="eyebrow">Low-bandwidth voice mode</span>
      <h1>Speak first. Type only if you need to.</h1>
      <p>Minimal mobile interface with the same four-language N-ATLAS voice path.</p>
    </div>
    <label>Language<select disabled={busy||voice.busy} value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>{LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
    <button className={recording?"liteMic recording":"liteMic"} type="button" disabled={(busy||voice.busy)&&!recording} onClick={recording?voice.stop:startVoice}>{recording?"■ Stop and send":"🎙️ Tap to speak"}</button>
    {(voice.error||status)&&<p className="liteStatus">{voice.error||status}</p>}
    {question&&<p className="liteStatus">Transcript / question: {question}</p>}
    <details>
      <summary>Prefer to type?</summary>
      <label>Your question<textarea rows={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type a menstrual-health question"/></label>
      <button className="btn" onClick={()=>ask(question)} disabled={busy||voice.busy}>{busy?"Checking…":"Ask Ìlera"}</button>
    </details>
    {answer&&<article className="liteAnswer"><p>{answer}</p><button className="secondaryBtn" type="button" onClick={()=>speak(answer,answerLanguage)}>🔊 Hear response</button></article>}
    <small>Educational health guidance only. A qualified healthcare professional should confirm suspected conditions.</small>
  </main>;
}
