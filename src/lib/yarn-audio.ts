import type { IlaraLanguage } from "./languages";
import { validRetryAt } from "./quota-retry";

export const YARN_TTS_MODEL = "saheedniyi/YarnGPT2b";
export type SpeechErrorKey = "speechQuota" | "voiceUnavailable";

export class YarnAudioError extends Error {
  constructor(public readonly key: SpeechErrorKey, public readonly retryAt?: string) {
    super(key);
  }
}

// Every listening control uses this verified audio route. Never substitute a
// device voice when the model is unavailable or its compute quota is exhausted.
export async function requestYarnAudio(text: string, language: IlaraLanguage, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch("/api/voice/audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, language }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 429) {
      let retryAt: string | undefined;
      try { retryAt = validRetryAt((await response.json()).retryAt); } catch { /* Retry time is optional. */ }
      throw new YarnAudioError("speechQuota", retryAt);
    }
    throw new YarnAudioError("voiceUnavailable");
  }
  const type = response.headers.get("content-type")?.split(";")[0];
  if (response.headers.get("x-speech-model") !== YARN_TTS_MODEL ||
      response.headers.get("x-speech-language") !== language ||
      !["audio/wav", "audio/x-wav"].includes(type || "")) {
    throw new YarnAudioError("voiceUnavailable");
  }
  const audio = await response.blob();
  if (!audio.size || audio.size > 4 * 1024 * 1024) throw new YarnAudioError("voiceUnavailable");
  return audio;
}
