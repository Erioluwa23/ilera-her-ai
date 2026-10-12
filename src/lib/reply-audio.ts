import { synthesizeViaYarnSpace } from "./natlas-space";
import type { IlaraLanguage } from "./languages";
import { YARN_TTS_MODEL } from "./yarn-audio";

export async function replyAudio(text: string, language: IlaraLanguage, signal?: AbortSignal) {
  return {
    audio: await synthesizeViaYarnSpace(text, language, signal),
    contentType: "audio/wav",
    model: YARN_TTS_MODEL,
  };
}
