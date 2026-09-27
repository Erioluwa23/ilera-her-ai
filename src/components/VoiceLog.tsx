"use client";
import {useRef,useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

type VoiceResult={
  transcript:string;
  answer:string;
  asrModel?:string;
  answerModel?:string;
  urgency?:string;
};

export default function VoiceLog(){
  const rec=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);
  const [recording,setRecording]=useState(false);
  const [status,setStatus]=useState("");
  const [result,setResult]=useState<VoiceResult|null>(null);
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");

  async function start(){
    try{
      setResult(null);setStatus("");
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current=[];
      const r=new MediaRecorder(stream);
      rec.current=r;
      r.ondataavailable=e=>chunks.current.push(e.data);
      r.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);
        setStatus("Transcribing with N-ATLAS…");
        const f=new FormData();
        f.append("audio",new Blob(chunks.current,{type:r.mimeType}),"voice.webm");
        f.append("language",language);
        try{
          const transcribeRes=await fetch("/api/transcribe",{method:"POST",body:f});
          const transcript=await transcribeRes.json();
          if(!transcribeRes.ok)throw new Error(transcript.error||"Transcription failed");

          setStatus("Generating a grounded response…");
          const answerRes=await fetch("/api/ask",{
            method:"POST",
            headers:{"content-type":"application/json"},
            body:JSON.stringify({question:transcript.text,language})
          });
          const answer=await answerRes.json();
          if(!answerRes.ok)throw new Error(answer.error||"Health response failed");

          setResult({
            transcript:transcript.text,
            answer:answer.answer,
            asrModel:transcript.model,
            answerModel:answer.model,
            urgency:answer.urgency
          });
          setStatus("");
        }catch(e){
          setStatus(e instanceof Error?e.message:"Voice processing is temporarily unavailable.");
        }
      };
      r.start();setRecording(true);
    }catch{
      setStatus("Microphone access was not available. You can still use the text assistant.");
    }
  }

  return <section className="panel voicepanel">
    <span className="eyebrow">N-ATLAS voice input</span>
    <h2>Speak your symptoms in your language</h2>
    <p className="muted">Your selected language stays attached to the complete ASR → health grounding → N-ATLAS response pipeline.</p>
    <label className="voiceLanguage">Language
      <select value={language} onChange={e=>setLanguage(e.target.value as IlaraLanguage)}>
        {LANGUAGE_OPTIONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}
      </select>
    </label>
    <button className="mic" onClick={recording?()=>rec.current?.stop():start}>{recording?"■":"🎙️"}</button>
    <b>{recording?"Listening…":"Tap to speak"}</b>
    {status&&<p className="transcript">{status}</p>}
    {result&&<div className="voiceResult">
      <p><strong>Transcript</strong><br/>{result.transcript}</p>
      <p><strong>ÌleraHer response</strong><br/>{result.answer}</p>
      {result.urgency&&<p><strong>Urgency:</strong> {result.urgency}</p>}
      <small>ASR: {result.asrModel||"N-ATLAS"} · Response: {result.answerModel==="n-atlas"?"N-ATLAS LLM":"grounded fallback"}</small>
    </div>}
  </section>;
}