"use client";
import { useEffect, useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "@/lib/languages";
import { useLanguage } from "@/lib/use-language";
import { useVoiceRecording } from "@/lib/use-voice-recording";
import { useVoicePlayback } from "@/lib/use-voice-playback";
import { contextFor, type VoiceMessage } from "@/lib/voice-chat";
import { loadVoiceMessages, saveVoiceMessage, deleteVoiceConversation } from "@/lib/voice-chat-store";
import VoiceMessageCard from "./VoiceMessageCard";
const PROMPTS: Record<IlaraLanguage, string> = {
  "en-NG": "Your voice, your conversation",
  yo: "Ohùn rẹ, ìjíròrò rẹ",
  ha: "Muryarki, tattaunawarki",
  ig: "Olu gị, mkparịta ụka gị",
};
export default function VoiceLog({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage(), voice = useVoiceRecording(), playback = useVoicePlayback();
  const [messages, setMessages] = useState<VoiceMessage[]>([]), [savedIds, setSavedIds] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState(""), [replyTo, setReplyTo] = useState<string>();
  const [loaded, setLoaded] = useState(false), [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState(""), [error, setError] = useState(""), [storageError, setStorageError] = useState("");
  const [seconds, setSeconds] = useState(0), [playingId, setPlayingId] = useState<string>(), [deletePending, setDeletePending] = useState(false);
  const currentMessages = useRef<VoiceMessage[]>([]), controller = useRef<AbortController | null>(null), mounted = useRef(true), active = useRef(false);
  const composer = useRef<HTMLDivElement>(null);
  const busy = voice.busy || processing;
  useEffect(() => {
    mounted.current = true;
    loadVoiceMessages().then(items => {
      if (!mounted.current) return;
      currentMessages.current = items;
      setMessages(items); setSavedIds(items.map(m => m.id));
      setConversationId(items.at(-1)?.conversationId || crypto.randomUUID());
    }).catch(() => {
      if (!mounted.current) return;
      setStorageError("Saved conversations could not be opened. New messages will stay in this tab until storage is available.");
      setConversationId(crypto.randomUUID());
    }).finally(() => { if (mounted.current) setLoaded(true); });
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!voice.recording) return;
    const timer = setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(timer);
  }, [voice.recording]);
  async function put(message: VoiceMessage) {
    const existing = currentMessages.current.some(m => m.id === message.id);
    const next = existing ? currentMessages.current.map(m => m.id === message.id ? message : m) : [...currentMessages.current, message];
    currentMessages.current = next;
    if (mounted.current) { setMessages(next); setSavedIds(ids => ids.filter(id => id !== message.id)); }
    try {
      await saveVoiceMessage(message);
      if (mounted.current) setSavedIds(ids => [...ids.filter(id => id !== message.id), message.id]);
    } catch (e) {
      if (mounted.current) setStorageError(e instanceof Error ? e.message : "Message could not be saved on this device.");
    }
  }
  async function patch(id: string, changes: Partial<VoiceMessage>) {
    const message = currentMessages.current.find(m => m.id === id);
    if (message) await put({ ...message, ...changes });
  }
  function stopAudio() {
    playback.stop(); setPlayingId(undefined);
    document.querySelectorAll<HTMLAudioElement>(".chatMessage audio").forEach(audio => audio.pause());
  }
  function cancel() {
    voice.cancel(); controller.current?.abort(); active.current = false; setProcessing(false); setStatus(""); stopAudio();
  }
  async function transcribe(message: VoiceMessage, signal: AbortSignal) {
    if (!message.audio) return;
    setStatus("Checking your recording…");
    const form = new FormData(); form.append("audio", message.audio, message.filename); form.append("language", message.language);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: form, signal });
      const data = await response.json();
      if (!response.ok || typeof data.text !== "string" || !data.text.trim()) throw new Error(data.error || "No speech was detected. Record again or retry this message.");
      if (!signal.aborted) await patch(message.id, { text: data.text, error: undefined });
    } catch (e) {
      if (!signal.aborted) await patch(message.id, { error: e instanceof Error ? e.message : "Transcription unavailable. Your recording is kept for replay and retry." });
    } finally { if (!signal.aborted && mounted.current) setStatus(""); }
  }
  async function record() {
    if (busy || active.current || !loaded) return;
    stopAudio(); setError(""); setSeconds(0);
    const parent = replyTo, thread = conversationId;
    await voice.start(language, async (audio, filename, code, signal) => {
      if (!audio.size) throw new Error("No audio was recorded. Please try again.");
      const message: VoiceMessage = { id: crypto.randomUUID(), conversationId: thread, role: "user", createdAt: Date.now(), language: code, audio, filename, replyTo: parent };
      await put(message);
      if (!signal.aborted) await transcribe(message, signal);
    });
  }
  async function task(work: (signal: AbortSignal) => Promise<void>) {
    if (busy || active.current) return;
    active.current = true;
    const abort = new AbortController(); controller.current = abort;
    setProcessing(true); setError("");
    try { await work(abort.signal); }
    catch (e) { if (!abort.signal.aborted && mounted.current) setError(e instanceof Error ? e.message : "Please try again."); }
    finally {
      if (controller.current === abort) { active.current = false; if (mounted.current) { setProcessing(false); setStatus(""); } }
    }
  }
  async function saveReplyAudio(message: VoiceMessage, signal: AbortSignal) {
    setStatus("Saving reply audio…");
    try {
      const response = await fetch("/api/voice/audio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `${message.text} ${message.disclaimer || ""}`, language: message.language }), signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Reply audio unavailable"); }
      const audio = await response.blob();
      if (!signal.aborted) await patch(message.id, { audio, filename: `ileraher-reply-${message.id}.${audio.type.includes("mpeg") ? "mp3" : "wav"}`, error: undefined });
    } catch (e) {
      if (!signal.aborted) await patch(message.id, { error: e instanceof Error ? e.message : "Reply audio unavailable. Device playback remains available." });
    }
  }
  async function send(message: VoiceMessage) {
    if (!message.text) return;
    await task(async signal => {
      setStatus("Preparing your reply…");
      await patch(message.id, { confirmed: true, error: undefined });
      try {
        const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: message.text, language: message.language, conversation: contextFor(currentMessages.current, message.replyTo) }), signal });
        const data = await response.json();
        if (!response.ok || typeof data.answer !== "string" || !data.answer.trim()) throw new Error(data.error || "Could not get guidance. Retry this message.");
        if (signal.aborted) return;
        const reply: VoiceMessage = { id: crypto.randomUUID(), conversationId: message.conversationId, role: "assistant", createdAt: Date.now(), language: message.language, replyTo: message.id, text: data.answer, urgency: data.urgency, disclaimer: data.disclaimer, sources: data.sources, model: data.model };
        await put(reply);
        if (mounted.current) setReplyTo(reply.id);
        await saveReplyAudio(reply, signal);
      } catch (e) {
        if (!signal.aborted) await patch(message.id, { error: e instanceof Error ? e.message : "Guidance unavailable. Retry this message." });
        else await patch(message.id, { error: "Reply cancelled. Retry guidance when ready." });
      }
    });
  }
  function followUp(message: VoiceMessage) {
    stopAudio(); setReplyTo(message.id); setLanguage(message.language);
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function newConversation() {
    stopAudio(); setConversationId(crypto.randomUUID()); setReplyTo(undefined); setDeletePending(false); setError("");
  }
  async function removeConversation() {
    await task(async () => {
      await deleteVoiceConversation(conversationId);
      const next = currentMessages.current.filter(m => m.conversationId !== conversationId);
      currentMessages.current = next; setMessages(next); stopAudio(); newConversation();
    });
  }
  const visible = messages.filter(m => m.conversationId === conversationId);
  const threads = [...new Set(messages.map(m => m.conversationId))].reverse();
  const selected = messages.find(m => m.id === replyTo);
  return <section className={`panel voicepanel voiceScreen voiceChat${compact ? " compactVoice" : ""}`}>
    <span className="eyebrow">{compact ? "Low-data voice chat" : "Ask privately · Voice chat"}</span>
    <h1>{PROMPTS[language]}</h1>
    <p className="muted">Record, listen again, and keep the conversation going.</p>
    <p className="chatPrivacy small">Recordings and replies are saved in this browser on this device. Clearing site data removes them. Recordings are sent for transcription. Confirmed transcripts and selected conversation context are sent for answers; reply text may be sent to the configured speech service.</p>
    <div className="chatToolbar">
      <label>Conversations<select disabled={busy || !loaded} value={conversationId} onChange={e => { stopAudio(); setConversationId(e.target.value); setReplyTo(undefined); setDeletePending(false); }}>
        {!threads.includes(conversationId) && <option value={conversationId}>New conversation</option>}
        {threads.map(id => { const first = messages.find(m => m.conversationId === id)!; return <option key={id} value={id}>{new Date(first.createdAt).toLocaleString()} · {messages.filter(m => m.conversationId === id).length} messages</option>; })}
      </select></label>
      <button className="secondaryBtn" disabled={busy || !loaded} onClick={newConversation}>＋ New conversation</button>
      {!!visible.length && <button className="textbtn" disabled={busy} onClick={() => setDeletePending(!deletePending)}>Delete conversation</button>}
    </div>
    {deletePending && <div className="shareNotice"><p>Delete all recordings and replies in this conversation from this device?</p><button className="secondaryBtn" disabled={busy} onClick={removeConversation}>Yes, delete conversation</button><button className="textbtn" onClick={() => setDeletePending(false)}>Keep it</button></div>}
    {storageError && <p className="risk attention" role="alert">{storageError}</p>}
    <div className="chatTimeline" aria-label="Voice conversation">
      {!loaded ? <p role="status">Opening saved conversations…</p> : !visible.length ? <div className="chatEmpty"><span>🎧</span><h2>Start with your voice</h2><p>Your messages will appear here. Listen whenever you need, or record a follow-up to any reply.</p></div> : visible.map(message => <VoiceMessageCard key={message.id} message={message} parent={messages.find(m => m.id === message.replyTo)} saved={savedIds.includes(message.id)} busy={busy} playbackState={playingId === message.id ? playback.state : "idle"}
        onListen={() => { stopAudio(); setPlayingId(message.id); playback.play(`${message.text} ${message.disclaimer || ""}`, message.language); }} onPause={playback.pause} onResume={playback.resume} onStop={stopAudio}
        onAudioPlay={element => { playback.stop(); setPlayingId(undefined); document.querySelectorAll<HTMLAudioElement>(".chatMessage audio").forEach(audio => { if (audio !== element) audio.pause(); }); }}
        onFollowUp={() => followUp(message)} onSend={() => send(message)} onRetry={() => task(signal => transcribe(message, signal))} onSaveAudio={() => task(signal => saveReplyAudio(message, signal))} />)}
    </div>
    <div ref={composer} className="voiceComposer">
      {selected && <div className="followUpBanner"><span>↳ Following up on {selected.role === "user" ? "your recording" : "ÌleraHer’s reply"} · {new Date(selected.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><button className="textbtn" disabled={busy} onClick={() => setReplyTo(undefined)}>Ask a new question</button></div>}
      <div className="voiceRecordBar">
        <button type="button" className={voice.recording ? "mic recording" : "mic"} disabled={!loaded || (busy && !voice.recording)} aria-label={voice.recording ? "Stop recording" : selected ? "Record voice follow-up" : "Start recording"} onClick={voice.recording ? voice.stop : record}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{voice.recording ? <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /> : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>}</svg>
        </button>
        <div className="recordBarCopy">
          <strong>{voice.recording ? "Recording…" : voice.busy ? "Checking audio…" : processing ? "Preparing reply…" : selected ? "Voice follow-up" : "Tap to speak"}</strong>
          {voice.recording ? <span role="timer">{seconds}s / 60s · Tap to stop</span> : <span>Up to 60s · Review before sending</span>}
          {busy && <button className="textbtn" onClick={cancel}>Cancel</button>}
        </div>
        <label className="chatLanguageSelect">Language
          <select aria-label="Choose language" value={language} disabled={busy} onChange={e => { setLanguage(e.target.value as IlaraLanguage); stopAudio(); }}>
            {LANGUAGE_OPTIONS.map(x => <option key={x.code} value={x.code}>{x.code === "en-NG" ? "English (NG)" : x.label}</option>)}
          </select>
        </label>
      </div>
      <p role="status" aria-live="polite">{status}</p>
      {(voice.error || error || playback.error) && <p role="alert" className="risk attention">{voice.error || error || playback.error}</p>}
      <p className="voiceHint">Saved recordings play without a new download. Online connection needed for new answers. Audio plays only when you choose.</p>
    </div>
  </section>;
}
