import { createHash } from "node:crypto";
import scripts from "./ivr-prompt-scripts.json";
import { YARN_TTS_MODEL } from "./yarn-audio";
import type { IlaraLanguage } from "./languages";

const core = ["consent", "record", "waiting", "menu", "error", "goodbye"];
const entrance = ["welcome", "invalid-choice", "menu-retries", "unavailable", "language-unavailable"];
const history = ["history-choice", "history-pin", "history-new-pin", "history-unavailable", "history-menu", "history-delete", "history-deleted"];
export function ivrPromptBase() {
  const url = new URL(process.env.IVR_PROMPT_BASE_URL || "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("Invalid telephone prompt origin");
  url.pathname = url.pathname.replace(/\/?$/, "/");
  return url;
}

// Public, non-personal menu audio is prepared once with YarnGPT. Cold incoming
// webhooks never wait on GPU generation just to explain consent or keypad keys.
async function bytes(url: URL, limit: number) {
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok || !response.body) throw new Error("Telephone prompt unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) { await reader.cancel(); throw new Error("Telephone prompt too large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
type Entry = { sha256: string; scriptHash: string; bytes: number; contentType: string };
let cached: { key: string; expires: number; ready: boolean } | undefined;
let pending: { key: string; promise: Promise<boolean> } | undefined;
export async function inspectIvrPrompts(languages: IlaraLanguage[], historyLanguages: IlaraLanguage[]) {
  let base: URL;
  try { base = ivrPromptBase(); } catch { return false; }
  const key = JSON.stringify([base.href, languages, historyLanguages]);
  if (cached?.key === key && cached.expires > Date.now()) return cached.ready;
  if (pending?.key === key) return pending.promise;
  const promise = (async () => {
    try {
      const manifest = JSON.parse((await bytes(new URL("manifest.json", base), 65536)).toString()) as {
        version: number; model: string; provider: string; files: Record<string, Entry>;
      };
      if (manifest.version !== 1 || manifest.model !== YARN_TTS_MODEL ||
          manifest.provider !== "ileraher_zerogpu_tts" || !manifest.files) return false;
      const required = [
        ...entrance.map((name) => ({ language: "en-NG" as IlaraLanguage, name })),
        ...languages.flatMap((language) => core.map((name) => ({ language, name }))),
        ...historyLanguages.flatMap((language) => history.map((name) => ({ language, name }))),
      ];
      const checks = await Promise.allSettled(required.map(async ({ language, name }) => {
        const path = `${language}/${name}.wav`;
        const entry = manifest.files[path];
        const script = (scripts[language] as Record<string, string>)[name];
        if (!script || !entry || entry.contentType !== "audio/wav" ||
            !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.bytes < 44 || entry.bytes > 4 * 1024 * 1024 ||
            entry.scriptHash !== createHash("sha256").update(script).digest("hex")) return false;
        const audio = await bytes(new URL(path, base), 4 * 1024 * 1024);
        return audio.length === entry.bytes && audio.toString("ascii", 0, 4) === "RIFF" &&
          audio.toString("ascii", 8, 12) === "WAVE" &&
          createHash("sha256").update(audio).digest("hex") === entry.sha256;
      }));
      return checks.every((check) => check.status === "fulfilled" && check.value === true);
    } catch { return false; }
  })();
  pending = { key, promise };
  try {
    const ready = await promise;
    cached = { key, ready, expires: Date.now() + (ready ? 10 * 60_000 : 30_000) };
    return ready;
  } finally { if (pending?.promise === promise) pending = undefined; }
}
