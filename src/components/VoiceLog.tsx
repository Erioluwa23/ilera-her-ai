"use client";
import {useState} from "react";
import {LANGUAGE_OPTIONS,IlaraLanguage} from "@/lib/languages";

import {useVoiceRecording,speakResponse} from "@/lib/use-voice-recording";

type VoiceResult={
  language:IlaraLanguage;
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

export default function VoiceLog(){
  const voice=useVoiceRecording();
  const {recording,busy}=voice;
  const [status,setStatus]=useState("");
  const [result,setResult]=useState<VoiceResult|null>(null);
  const [language,setLanguage]=useState<IlaraLanguage>("en-NG");
  const copy=COPY[language];

  function speak(text:string,code:IlaraLanguage){
    if(!speakResponse(text,code))setStatus("Speech playback for this language is unavailable on this device. Read the response below.");
  }
  async function start(){
    setResult(null);setStatus("");
    await voice.start(language,async(audio,filename,code,signal)=>{
      setStatus(COPY[code].transcribing);
      const f=new FormData();f.append("audio",audio,filename);f.append("language",code);
      const transcribeRes=await fetch("/api/transcribe",{method:"POST",body:f,signal});
      const transcript=await transcribeRes.json();
      if(!transcribeRes.ok)throw new Error(transcript.error||"Transcription failed");
      if(signal.aborted)return;
      setResult({transcript:transcript.text,answer:"",asrModel:transcript.model,language:code});
      setStatus(COPY[code].responding);
      const answerRes=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:transcript.text,language:code}),signal});
      const answer=await answerRes.json();
      if(!answerRes.ok)throw new Error(answer.error||"Health response failed");
      if(signal.aborted)return;
      setResult({transcript:transcript.text,answer:answer.answer,asrModel:transcript.model,answerModel:answer.model,urgency:answer.urgency,language:code});
      setStatus("");
    });
  }

  return <section className="panel voicepanel primaryVoice" id="voice">
    <span className="eyebrow">Voice support</span>
    <h2>{copy.title}</h2>
    <p className="muted">{copy.subtitle}</p>
    <div className="languagePills" aria-label="Choose language">
      {LANGUAGE_OPTIONS.map(x=><button key={x.code} type="button" className={language===x.code?"languageChoice active":"languageChoice"} disabled={busy} aria-pressed={language===x.code} onClick={()=>setLanguage(x.code)}>{x.label}</button>)}
    </div>
    <button className={recording?"mic recording":"mic"} aria-label={recording?"Stop recording":"Start recording"} disabled={busy&&!recording} onClick={recording?voice.stop:start}>{recording?"■":"🎙️"}</button>
    <b>{recording?copy.listening:copy.tap}</b>
    <p className="voiceHint">Online connection needed for answers. Audio plays only when you choose.</p>
    <a className="textlink" href="#ask">Type instead →</a>
    {(voice.error||status)&&<p className="transcript statusBox">{voice.error||status}</p>}
    {result&&<div className="voiceResult">
      <div className="voiceResultBlock"><span>Transcript</span><p>{result.transcript}</p></div>
      <div className="voiceResultBlock"><span>ÌleraHer</span><p>{result.answer}</p></div>
      {result.urgency&&<div className={"risk "+result.urgency}><strong>Urgency: {result.urgency}</strong></div>}
      <button className="secondaryBtn" type="button" disabled={!result.answer} onClick={()=>speak(result.answer,result.language)}>🔊 {copy.replay}</button>
      <small>ASR: {result.asrModel||"N-ATLAS"} · Response: {result.answerModel==="n-atlas"?"N-ATLAS":"language-grounded response"}</small>
    </div>}
  </section>;
}
