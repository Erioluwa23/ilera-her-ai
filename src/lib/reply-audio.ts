import { synthesizeViaYarnSpace } from "./natlas-space";
import type { IlaraLanguage } from "./languages";

export async function replyAudio(text: string, language: IlaraLanguage, signal?: AbortSignal) {
  const configured = process.env.VOICE_TTS_API_URL;
  if (!configured) return { audio: await synthesizeViaYarnSpace(text, language, signal), contentType: "audio/wav", model: "saheedniyi/YarnGPT2b" };
  if (!(process.env.VOICE_TTS_LANGUAGES || "").split(",").map(x => x.trim()).includes(language)) throw new Error("Speech language is unavailable");
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid speech provider");
  const response = await fetch(url, {
    method: "POST", redirect: "error", signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]),
    headers: { "content-type": "application/json", ...(process.env.VOICE_TTS_API_KEY ? { Authorization: `Bearer ${process.env.VOICE_TTS_API_KEY}` } : {}) },
    body: JSON.stringify({ text, language }),
  });
  const contentType = (response.headers.get("content-type") || "").split(";")[0];
  if (!response.ok || !response.body || !["audio/mpeg", "audio/wav", "audio/x-wav"].includes(contentType)) throw new Error("Invalid reply audio");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("Reply audio too large"); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error("Empty reply audio");
  return { audio: Buffer.concat(chunks), contentType, model: "configured-tts" };
}
