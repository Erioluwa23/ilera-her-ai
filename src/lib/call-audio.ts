import { NATLAS_ASR_MODELS, type IlaraLanguage } from "./languages";
import { YARN_TTS_MODEL } from "./yarn-audio";

export type CallReply = {
  question: string; answer: string; nextSteps: string[]; disclaimer: string;
  language: IlaraLanguage; model: "n-atlas" | "curated";
  sources: { title: string; url: string }[];
};
export function callReplyPreview(value: unknown, language: IlaraLanguage): CallReply | undefined {
  if (!value || typeof value !== "object") return;
  const reply = value as Record<string, unknown>;
  if (reply.language !== language || !["n-atlas", "curated"].includes(String(reply.model)) ||
      typeof reply.question !== "string" || typeof reply.answer !== "string" || typeof reply.disclaimer !== "string" ||
      !Array.isArray(reply.nextSteps) || reply.nextSteps.some(s => typeof s !== "string")) return;
  const sources = Array.isArray(reply.sources) ? reply.sources.flatMap(s => {
    if (!s || typeof s !== "object" || typeof s.title !== "string" || typeof s.url !== "string") return [];
    try { return new URL(s.url).protocol === "https:" ? [{ title: s.title, url: s.url }] : []; } catch { return []; }
  }) : [];
  return { question: reply.question, answer: reply.answer, disclaimer: reply.disclaimer,
    nextSteps: reply.nextSteps as string[], sources, language, model: reply.model as CallReply["model"] };
}
export function decodeCallAudio(value: unknown, language: IlaraLanguage, turnId: string) {
  if (!value || typeof value !== "object") throw new Error("Invalid call reply.");
  const data = value as Record<string, unknown>, reply = callReplyPreview(data, language);
  if (!reply || data.turnId !== turnId || data.speechModel !== YARN_TTS_MODEL ||
      data.transcriptionModel !== NATLAS_ASR_MODELS[language] || data.contentType !== "audio/wav" ||
      !Number.isInteger(data.turnsRemaining) || Number(data.turnsRemaining) < 0 || Number(data.turnsRemaining) > 5 ||
      typeof data.audio !== "string" || data.audio.length > 5_592_408 ||
      data.audio.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.audio))
    throw new Error("Unverified call audio.");
  const bytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
  const header = new TextDecoder().decode(bytes.subarray(0, 12));
  if (bytes.length < 44 || bytes.length > 4 * 1024 * 1024 || !header.startsWith("RIFF") || header.slice(8, 12) !== "WAVE")
    throw new Error("Invalid call audio.");
  return { reply, audio: new Blob([bytes], { type: "audio/wav" }), turnsRemaining: Number(data.turnsRemaining) };
}

// Send a bounded mono 16 kHz PCM WAV. This avoids browser-specific compressed
// recordings entering the phone adapter and enforces the 30-second limit.
export function encodeCallWav(channels: readonly Float32Array[], sampleRate: number) {
  if (!channels.length || channels.length > 8 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !channels[0].length || channels.some(c => c.length !== channels[0].length)) throw new Error("Invalid recording.");
  const rate = 16000, count = Math.min(rate * 30, Math.floor(channels[0].length * rate / sampleRate));
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const word = (at: number, text: string) => { [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0))); };
  word(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); word(8, "WAVE"); word(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, "data"); view.setUint32(40, count * 2, true);
  const ratio = sampleRate / rate;
  for (let i = 0; i < count; i++) {
    const from = i * ratio, to = (i + 1) * ratio;
    let total = 0, weight = 0;
    for (let n = Math.floor(from); n < Math.ceil(to) && n < channels[0].length; n++) {
      const w = Math.min(to, n + 1) - Math.max(from, n);
      for (const channel of channels) { total += channel[n] * w; weight += w; }
    }
    const sample = Math.max(-1, Math.min(1, total / (weight || 1)));
    view.setInt16(44 + i * 2, Number.isFinite(sample) ? Math.round(sample * (sample < 0 ? 32768 : 32767)) : 0, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
