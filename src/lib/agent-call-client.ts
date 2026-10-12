import type { IlaraLanguage } from "./languages";
import { callReplyPreview, decodeCallAudio, encodeCallWav, type CallReply } from "./call-audio";
import { validRetryAt } from "./quota-retry";

export type CallPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "paused" | "ended" | "error";
export type CallSnapshot = {
  phase: CallPhase; active: boolean; muted: boolean; elapsed: number; level: number;
  pendingAudio: boolean; reply?: CallReply; error?: "microphoneUnavailable" | "callUnavailable" | "speechQuota" | "asrQuota";
  retryAt?: string;
};
export const INITIAL_CALL: CallSnapshot = { phase: "idle", active: false, muted: false, elapsed: 0, level: 0, pendingAudio: false };
type Grant = { callId: string; grant: string; language: IlaraLanguage; expiresAt: string; maxTurns: number };

// A short-turn audio call over the existing app API. No telephone provider,
// hardware, browser speech synthesis or credential in client storage is needed.
export class AgentCallClient {
  private snapshot = INITIAL_CALL;
  private epoch = 0;
  private mounted = false;
  private session: Grant | null = null;
  private abort: AbortController | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private detection: ReturnType<typeof setInterval> | null = null;
  private duration: ReturnType<typeof setInterval> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private finishRecording: ((send: boolean) => void) | null = null;
  private turnsRemaining = 6;
  private started = 0;
  constructor(private readonly notify: (snapshot: CallSnapshot) => void) {}
  mount() { this.mounted = true; }
  private update(change: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    if (this.mounted) this.notify(this.snapshot);
  }
  private current(epoch: number) { return this.mounted && epoch === this.epoch && !this.abort?.signal.aborted; }
  private stopDetection() {
    if (this.detection) clearInterval(this.detection);
    this.detection = null;
  }
  private releaseAudio() {
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio.src = ""; }
    this.audio = null;
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
  }
  private event(session: Grant, event: string, extras: Record<string, unknown> = {}) {
    return fetch("/api/phone/call/event", { method: "POST", credentials: "same-origin", keepalive: true,
      signal: AbortSignal.timeout(10_000), headers: { "content-type": "application/json" }, body: JSON.stringify({ callId: session.callId, grant: session.grant, event, ...extras }) });
  }
  private close() {
    const session = this.session;
    this.epoch++; this.abort?.abort(); this.abort = null; this.session = null;
    this.finishRecording = null; this.stopDetection();
    if (this.duration) clearInterval(this.duration);
    if (this.deadline) clearTimeout(this.deadline);
    this.duration = null; this.deadline = null;
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null; this.releaseAudio();
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    void this.context?.close().catch(() => {}); this.context = null; this.analyser = null;
    if (session) void this.event(session, "end").catch(() => {});
  }
  unmount() { this.mounted = false; this.close(); }
  hangup() {
    if (!this.snapshot.active) return;
    this.close(); this.update({ phase: "ended", active: false, muted: false, level: 0, pendingAudio: false });
  }
  private fail(error: CallSnapshot["error"], retryAt?: string, reply?: CallReply) {
    this.close(); this.update({ phase: "error", active: false, muted: false, level: 0, pendingAudio: false,
      error, retryAt, ...(reply ? { reply } : {}) });
  }
  async start(language: IlaraLanguage) {
    if (this.snapshot.active) return;
    this.close();
    const epoch = this.epoch, abort = new AbortController(); this.abort = abort;
    this.snapshot = { ...INITIAL_CALL, phase: "connecting", active: true }; this.update({});
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      this.fail("microphoneUnavailable"); return;
    }
    try {
      // Create/resume during the user's call gesture for mobile Web Audio.
      const context = new AudioContext(); this.context = context;
      await context.resume();
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch { if (this.current(epoch)) this.fail("microphoneUnavailable"); return; }
      if (!this.current(epoch)) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      const response = await fetch("/api/phone/call", { method: "POST", credentials: "same-origin", signal: abort.signal,
        headers: { "content-type": "application/json" }, body: JSON.stringify({ language, consented: true }) });
      const session: Grant = await response.json();
      if (!this.current(epoch)) return;
      if (!response.ok || !/^[a-f0-9-]{36}$/i.test(session.callId) || !/^[A-Za-z0-9_-]{43}$/.test(session.grant) || session.language !== language ||
          !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now() || session.maxTurns !== 6)
        throw new Error("Call connection failed.");
      this.session = session; this.turnsRemaining = session.maxTurns;
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser); this.analyser = analyser;
      this.started = performance.now();
      this.duration = setInterval(() => { if (this.current(epoch)) this.update({ elapsed: Math.floor((performance.now() - this.started) / 1000) }); }, 1000);
      this.deadline = setTimeout(() => { if (this.current(epoch)) this.hangup(); }, Math.min(15 * 60_000, Date.parse(session.expiresAt) - Date.now()));
      window.dispatchEvent(new CustomEvent("ileraher-audio-play", { detail: "agent-call" }));
      this.listen(epoch);
    } catch { if (this.current(epoch)) this.fail("callUnavailable"); }
  }
  private listen(epoch: number) {
    if (!this.current(epoch) || !this.session || !this.stream || !this.context || !this.analyser) return;
    if (this.turnsRemaining === 0) { this.hangup(); return; }
    if (this.snapshot.muted) { this.update({ phase: "paused", level: 0 }); return; }
    this.stream.getAudioTracks().forEach(t => { t.enabled = true; });
    this.stopDetection(); this.releaseAudio();
    try {
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      let stopped = false, send = false, heard = false, speechDuration = 0, lastSpeech = 0;
      const began = performance.now(), samples = new Float32Array(this.analyser.fftSize);
      this.recorder = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = () => { if (this.current(epoch)) this.fail("microphoneUnavailable"); };
      this.finishRecording = shouldSend => {
        if (stopped || !this.current(epoch)) return;
        stopped = true; send = shouldSend; this.finishRecording = null; this.stopDetection();
        this.stream?.getAudioTracks().forEach(t => { t.enabled = false; });
        this.update({ phase: send ? "thinking" : "paused", level: 0 });
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.onstop = () => {
        if (this.recorder === recorder) this.recorder = null;
        if (send && this.current(epoch)) void this.turn(new Blob(chunks, { type: recorder.mimeType }), epoch);
      };
      recorder.start(); this.update({ phase: "listening", pendingAudio: false });
      this.detection = setInterval(() => {
        if (!this.current(epoch) || stopped) return;
        const now = performance.now();
        this.analyser!.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
        this.update({ level: Math.min(1, rms * 8) });
        if (rms > 0.025) { speechDuration += 100; lastSpeech = now; if (speechDuration >= 300) heard = true; }
        if (heard && now - lastSpeech > 1500 && now - began > 1000) this.finishRecording?.(true);
        else if (now - began >= 30_000) this.finishRecording?.(heard);
        else if (!heard && now - began >= 15_000) this.finishRecording?.(false);
      }, 100);
    } catch { if (this.current(epoch)) this.fail("microphoneUnavailable"); }
  }
  send() { if (this.snapshot.phase === "listening") this.finishRecording?.(true); }
  resumeListening() { if (this.snapshot.phase === "paused" && !this.snapshot.pendingAudio) { this.update({ muted: false }); this.listen(this.epoch); } }
  toggleMute() {
    if (!this.session) return;
    const muted = !this.snapshot.muted; this.update({ muted });
    if (muted && this.snapshot.phase === "listening") this.finishRecording?.(false);
    else if (!muted && this.snapshot.phase === "paused" && !this.snapshot.pendingAudio) this.listen(this.epoch);
  }
  private async turn(recording: Blob, epoch: number) {
    const session = this.session, context = this.context, abort = this.abort;
    if (!session || !context || !abort || !this.current(epoch)) return;
    try {
      const decoded = await context.decodeAudioData(await recording.arrayBuffer());
      if (!this.current(epoch)) return;
      const audio = encodeCallWav(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate);
      const turnId = crypto.randomUUID(), form = new FormData();
      form.set("callId", session.callId); form.set("grant", session.grant); form.set("turnId", turnId); form.set("audio", audio, "call.wav");
      const response = await fetch("/api/phone/call/turn", { method: "POST", credentials: "same-origin", body: form,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(230_000)]) });
      const data = await response.json();
      if (!this.current(epoch)) return;
      if (!response.ok) {
        const quota = response.status === 429 && ["ASR_QUOTA", "TTS_QUOTA"].includes(data.code);
        this.fail(quota ? data.code === "ASR_QUOTA" ? "asrQuota" : "speechQuota" : "callUnavailable",
          quota ? validRetryAt(data.retryAt) : undefined, callReplyPreview(data.reply, session.language));
        return;
      }
      const verified = decodeCallAudio(data, session.language, turnId);
      this.turnsRemaining = verified.turnsRemaining;
      this.audioUrl = URL.createObjectURL(verified.audio); this.audio = new Audio(this.audioUrl);
      this.audio.onended = async () => {
        if (!this.current(epoch)) return;
        // Acknowledge this turn before recording another one so its optional
        // saved reply cannot race a subsequent turn or the final hang-up.
        this.update({ phase: "thinking", pendingAudio: false });
        try { await this.event(session, "played", { turnId }); } catch { /* Audio was heard; saving may be unavailable. */ }
        if (!this.current(epoch)) return;
        this.update({ pendingAudio: false });
        this.listen(epoch);
      };
      this.audio.onerror = () => { if (this.current(epoch)) this.fail("callUnavailable"); };
      this.update({ reply: verified.reply });
      await this.playReply(epoch);
    } catch { if (this.current(epoch)) this.fail("callUnavailable"); }
  }
  private async playReply(epoch: number) {
    const audio = this.audio;
    if (!audio || !this.current(epoch)) return;
    this.update({ phase: "speaking", pendingAudio: false });
    try { await audio.play(); }
    catch { if (this.current(epoch) && this.audio === audio) this.update({ phase: "paused", pendingAudio: true }); }
  }
  playPending() { return this.playReply(this.epoch); }
}
