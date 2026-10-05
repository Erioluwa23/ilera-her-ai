"use client";
import { useEffect, useState } from "react";
import type { VoiceMessage } from "@/lib/voice-chat";
import { LANGUAGE_OPTIONS } from "@/lib/languages";

export default function VoiceMessageCard({ message, parent, saved, busy, playbackState, onListen, onPause, onResume, onStop, onAudioPlay, onFollowUp, onSend, onRetry, onSaveAudio }: {
  message: VoiceMessage; parent?: VoiceMessage; saved: boolean; busy: boolean;
  playbackState: "idle" | "playing" | "paused";
  onListen: () => void; onPause: () => void; onResume: () => void; onStop: () => void;
  onAudioPlay: (element: HTMLAudioElement) => void;
  onFollowUp: () => void; onSend: () => void; onRetry: () => void; onSaveAudio: () => void;
}) {
  const [url, setUrl] = useState(""), [sharing, setSharing] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    if (!message.audio) return;
    const next = URL.createObjectURL(message.audio);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [message.audio]);
  const language = LANGUAGE_OPTIONS.find(x => x.code === message.language)?.label;
  function file() {
    if (message.audio) return new File([message.audio], message.filename || `ileraher-${message.id}.mp3`, { type: message.audio.type });
    return new File([`${message.text || ""}\n\n${message.disclaimer || ""}\n${(message.sources || []).map(s => `${s.title}: ${s.url}`).join("\n")}`], `ileraher-reply-${message.id}.txt`, { type: "text/plain" });
  }
  function download() {
    const next = URL.createObjectURL(file());
    const link = document.createElement("a");
    link.href = next; link.download = file().name; link.click();
    setTimeout(() => URL.revokeObjectURL(next), 1000);
  }
  async function share() {
    setNotice("");
    const attachment = file();
    try {
      if (navigator.share && navigator.canShare?.({ files: [attachment] })) {
        await navigator.share({ files: [attachment], title: "ÌleraHer voice message" });
      } else {
        download();
        setNotice("Downloaded. Attach this file in the app you want to share it with.");
      }
      setSharing(false);
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setNotice("Sharing is unavailable. Use Download instead.");
    }
  }
  return <article className={`chatMessage ${message.role}`} id={`message-${message.id}`}>
    <div className="messageMeta"><strong>{message.role === "user" ? "You" : "ÌleraHer"}</strong><span>{language} · {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
    {parent && <a className="replyReference" href={`#message-${parent.id}`}>↳ In reply to {parent.role === "user" ? "your recording" : "ÌleraHer’s reply"} at {new Date(parent.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</a>}
    {url ? <audio controls preload="metadata" src={url} aria-label={message.role === "user" ? "Replay your saved recording" : "Replay saved guidance"} onPlay={e => onAudioPlay(e.currentTarget)} /> : message.role === "assistant" ? <div className="messagePlayback">
      {playbackState === "idle" ? <button className="btn" onClick={onListen}>▶ Listen to reply</button> : <><button className="btn" onClick={playbackState === "paused" ? onResume : onPause}>{playbackState === "paused" ? "▶ Resume" : "Ⅱ Pause"}</button><button className="secondaryBtn" onClick={onStop}>Stop</button></>}
      <span className="small muted">Device voice · downloadable audio pending</span>
    </div> : null}
    {message.text && <details className="messageTranscript" open={message.role === "user" && !message.confirmed}><summary>{message.role === "user" && !message.confirmed ? "Check what we heard" : "View transcript"}</summary><p>{message.text}</p>{message.disclaimer && <p className="small muted">{message.disclaimer}</p>}{!!message.sources?.length && <ul>{message.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>}</details>}
    {message.urgency && <p className={`risk ${message.urgency}`}>Care priority: {message.urgency}</p>}
    {message.error && <p className={message.role === "user" ? "risk attention" : "small muted"} role="status">{message.error}</p>}
    <div className="messageActions">
      {message.role === "user" && message.text && (!message.confirmed || message.error) && <button className="btn" disabled={busy} onClick={onSend}>{message.confirmed ? "Retry guidance" : "Confirm & send"}</button>}
      {message.role === "user" && !message.text && <button className="secondaryBtn" disabled={busy} onClick={onRetry}>Retry transcription</button>}
      {(message.role === "assistant" || message.confirmed) && <button className="secondaryBtn" disabled={busy} onClick={onFollowUp}>↳ Voice follow-up</button>}
      {message.role === "assistant" && !message.audio && <button className="textbtn" disabled={busy} onClick={onSaveAudio}>Save reply audio</button>}
      <button className="textbtn" onClick={() => setSharing(!sharing)}>Share</button>
      <button className="textbtn" onClick={download} aria-label={message.audio ? "Download audio" : "Download reply"}>Download</button>
    </div>
    {sharing && <div className="shareNotice"><p>This shares this message outside ÌleraHer. It may contain private health information.</p><button className="secondaryBtn" onClick={share}>Share this message</button><button className="textbtn" onClick={() => setSharing(false)}>Cancel</button></div>}
    {notice && <p role="status" className="small">{notice}</p>}
    <span className="messageSaved">{saved ? "Saved on this device" : "Not saved yet · keep this tab open"}</span>
  </article>;
}
