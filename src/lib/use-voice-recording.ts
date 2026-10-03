"use client";
import {useEffect,useRef,useState} from "react";
import type {IlaraLanguage} from "./languages";

export function recordingFilename(type:string){
  return type.includes("mp4")?"voice.m4a":type.includes("ogg")?"voice.ogg":type.includes("wav")?"voice.wav":"voice.webm";
}

export function useVoiceRecording(){
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const active=useRef(false);
  const mounted=useRef(true);
  const controller=useRef<AbortController|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    mounted.current=true;
    return()=>{
      mounted.current=false;controller.current?.abort();
      if(timer.current)clearTimeout(timer.current);
      if(recorder.current?.state==="recording")recorder.current.stop();
      stream.current?.getTracks().forEach(track=>track.stop());
    };
  },[]);
  function stop(){if(recorder.current?.state==="recording")recorder.current.stop()}
  async function start(language:IlaraLanguage,done:(audio:Blob,filename:string,language:IlaraLanguage,signal:AbortSignal)=>Promise<void>){
    if(active.current)return;
    active.current=true;setBusy(true);setError("");
    const abort=new AbortController();controller.current=abort;
    let media:MediaStream;
    try{media=await navigator.mediaDevices.getUserMedia({audio:true})}catch{
      active.current=false;if(mounted.current){setBusy(false);setError("Microphone access is unavailable. You can type your question.")};return;
    }
    if(abort.signal.aborted){media.getTracks().forEach(track=>track.stop());active.current=false;return}
    stream.current=media;
    try{
      const r=new MediaRecorder(media);recorder.current=r;
      const chunks:Blob[]=[];
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      r.onerror=()=>{setError("Audio recording failed.");stop()};
      r.onstop=async()=>{
        if(timer.current)clearTimeout(timer.current);
        media.getTracks().forEach(track=>track.stop());stream.current=null;
        if(mounted.current)setRecording(false);
        try{
          if(!abort.signal.aborted)await done(new Blob(chunks,{type:r.mimeType}),recordingFilename(r.mimeType),language,abort.signal);
        }catch(e){if(mounted.current&&!abort.signal.aborted)setError(e instanceof Error?e.message:"Voice processing failed.")}
        finally{active.current=false;if(mounted.current)setBusy(false)}
      };
      r.start();setRecording(true);timer.current=setTimeout(stop,60000);
    }catch{
      media.getTracks().forEach(track=>track.stop());active.current=false;
      if(mounted.current){setBusy(false);setError("This browser cannot record supported audio. You can type your question.")}
    }
  }
  return {recording,busy,error,start,stop};
}

export function speakResponse(text:string,language:IlaraLanguage):boolean{
  if(typeof window==="undefined"||!("speechSynthesis" in window))return false;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().split("-")[0]===language.toLowerCase().split("-")[0]);
  if(!voice)return false;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.95;
  window.speechSynthesis.speak(utterance);return true;
}
