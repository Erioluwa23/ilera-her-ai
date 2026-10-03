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

const COPY:Record<IlaraLanguage,{title:string;subtitle:string;tap:string;listening:string;transcribing:string;responding:string;replay:string}>={
  "en-NG":{title:"Speak your symptoms in your language",subtitle:"Tap once, speak naturally, then tap again when you finish.",tap:"Tap to speak",listening:"Listening… tap to finish",transcribing:"Transcribing with N-ATLAS…",responding:"Preparing your response…",replay:"Hear response again"},
  yo:{title:"Sọ ohun tó ń ṣe ọ́ ní èdè rẹ",subtitle:"Tẹ ẹ lẹ́ẹ̀kan, sọ̀rọ̀, kí o sì tẹ ẹ lẹ́ẹ̀kan síi nígbà tí o bá parí.",tap:"Tẹ láti sọ̀rọ̀",listening:"Mo ń gbọ́… tẹ láti parí",transcribing:"N-ATLAS ń kọ ohun tí o sọ…",responding:"A ń pèsè ìdáhùn rẹ…",replay:"Gbọ́ ìdáhùn lẹ́ẹ̀kansi"},
  ha:{title:"Yi magana game da alamominki da harshenki",subtitle:"Danna sau ɗaya, yi magana, sannan danna kuma idan kin gama.",tap:"Danna ki yi magana",listening:"Ana sauraro… danna ki gama",transcribing:"N-ATLAS na rubuta abin da kika faɗa…",responding:"Ana shirya amsarki…",replay:"Sake sauraron amsa"},
  ig:{title:"Kwuo mgbaàmà gị n'asụsụ gị",subtitle:"Pịa otu ugboro, kwuo okwu, pịa ọzọ mgbe ị mechara.",tap:"Pịa ka ị kwuo okwu",listening:"Ana m ege ntị… pịa ka ị kwụsị",transcribing:"N-ATLAS na-ede ihe ị kwuru…",responding:"A na-akwadebe azịza gị…",replay:"Gee azịza ahụ ọzọ"}
};

const SPEECH_LANG:Record<IlaraLanguage,string>={"en-NG":"en-NG",yo:"yo-NG",ha:"ha-NG",ig:"ig-NG"};

export default function VoiceLog(){
  const rec=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]);
  const [recording,setRecording]=useState(false);
  const [status,setStatus]=useState("");
  const [result,setResult]=useState<VoiceResult|null>(null);
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const copy=COPY[language];

  function speak(text:string){
    if(typeof window==="undefined"||!("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang=SPEECH_LANG[language];
    utterance.rate=0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function start(){
    try{
      setResult(null);setStatus("");
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current=[];
      const r=new MediaRecorder(stream);
      rec.current=r;
      r.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data)};
      r.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);
        setStatus(copy.transcribing);
        const f=new FormData();
        f.append("audio",new Blob(chunks.current,{type:r.mimeType}),"voice.webm");
        f.append("language",language);
        try{
          const transcribeRes=await fetch("/api/transcribe",{method:"POST",body:f});
          const transcript=await transcribeRes.json();
          if(!transcribeRes.ok)throw new Error(transcript.error||"Transcription failed");

          setStatus(copy.responding);
          const answerRes=await fetch("/api/ask",{
            method:"POST",
            headers:{"content-type":"application/json"},
            body:JSON.stringify({question:transcript.text,language})
          });
          const answer=await answerRes.json();
          if(!answerRes.ok)throw new Error(answer.error||"Health response failed");

          const next={
            transcript:transcript.text,
            answer:answer.answer,
            asrModel:transcript.model,
            answerModel:answer.model,
            urgency:answer.urgency
          };
          setResult(next);
          setStatus("");
          speak(next.answer);
        }catch(e){
          setStatus(e instanceof Error?e.message:"Voice processing is temporarily unavailable.");
        }
      };
      r.start();setRecording(true);
    }catch{
      setStatus("Microphone access was not available. You can still use the text assistant.");
    }
  }

  return <section className="panel voicepanel primaryVoice" id="voice">
    <span className="eyebrow">Primary access · N-ATLAS voice</span>
    <h2>{copy.title}</h2>
    <p className="muted">{copy.subtitle}</p>
    <div className="languagePills" aria-label="Choose language">
      {LANGUAGE_OPTIONS.map(x=><button key={x.code} type="button" className={language===x.code?"languageChoice active":"languageChoice"} onClick={()=>setLanguage(x.code)}>{x.label}</button>)}
    </div>
    <button className={recording?"mic recording":"mic"} aria-label={recording?"Stop recording":"Start recording"} onClick={recording?()=>rec.current?.stop():start}>{recording?"■":"🎙️"}</button>
    <b>{recording?copy.listening:copy.tap}</b>
    {status&&<p className="transcript statusBox">{status}</p>}
    {result&&<div className="voiceResult">
      <div className="voiceResultBlock"><span>Transcript</span><p>{result.transcript}</p></div>
      <div className="voiceResultBlock"><span>ÌleraHer</span><p>{result.answer}</p></div>
      {result.urgency&&<div className={"risk "+result.urgency}><strong>Urgency: {result.urgency}</strong></div>}
      <button className="secondaryBtn" type="button" onClick={()=>speak(result.answer)}>🔊 {copy.replay}</button>
      <small>ASR: {result.asrModel||"N-ATLAS"} · Response: {result.answerModel==="n-atlas"?"N-ATLAS":"language-grounded response"}</small>
    </div>}
  </section>;
}
