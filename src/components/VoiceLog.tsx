"use client";
import {useRef,useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

export default function VoiceLog(){
  const rec=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);
  const [recording,setRecording]=useState(false);
  const [msg,setMsg]=useState("");
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");

  async function start(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current=[];
      const r=new MediaRecorder(stream);
      rec.current=r;
      r.ondataavailable=e=>chunks.current.push(e.data);
      r.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const f=new FormData();
        f.append("audio",new Blob(chunks.current,{type:r.mimeType}),"voice.webm");
        f.append("language",language);
        try{
          const res=await fetch("/api/transcribe",{method:"POST",body:f});
          const data=await res.json();
          setMsg(res.ok?`${data.text}\n\nN-ATLAS model: ${data.model}`:(data.error||"Voice captured, but transcription is not configured."));
        }catch{setMsg("Voice captured. Transcription is temporarily unavailable.")}
        setRecording(false);
      };
      r.start();setRecording(true);
    }catch{setMsg("Microphone access was not available. You can still use the tracker manually.")}
  }

  return <section className="panel voicepanel">
    <span className="eyebrow">N-ATLAS voice input</span>
    <h2>Speak your symptoms in your language</h2>
    <p className="muted">Choose a language first. Your recording is routed to the matching official N-ATLAS ASR model.</p>
    <label className="voiceLanguage">Language
      <select value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>
        {LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}
      </select>
    </label>
    <button className="mic" onClick={recording?()=>rec.current?.stop():start}>{recording?"■":"🎙️"}</button>
    <b>{recording?"Listening…":"Tap to speak"}</b>
    {msg&&<p className="transcript">{msg}</p>}
  </section>;
}