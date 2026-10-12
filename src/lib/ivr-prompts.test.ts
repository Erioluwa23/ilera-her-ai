import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import scripts from "./ivr-prompt-scripts.json";
import { YARN_TTS_MODEL } from "./yarn-audio";

const fetchMock = vi.fn();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const audio = Buffer.alloc(46); audio.write("RIFF"); audio.writeUInt32LE(38, 4); audio.write("WAVE", 8);
function pack() {
  const files: Record<string, { sha256: string; scriptHash: string; bytes: number; contentType: string }> = {};
  for (const [language, prompts] of Object.entries(scripts)) for (const [name, script] of Object.entries(prompts))
    files[`${language}/${name}.wav`] = { sha256: hash(audio), scriptHash: hash(script), bytes: audio.length, contentType: "audio/wav" };
  return { version: 1, model: YARN_TTS_MODEL, provider: "ileraher_zerogpu_tts", files };
}
beforeEach(() => {
  vi.resetModules(); vi.unstubAllEnvs(); vi.clearAllMocks();
  vi.stubEnv("IVR_PROMPT_BASE_URL", "https://audio.example.test/ivr/");
  vi.stubGlobal("fetch", fetchMock);
});
describe("recorded YarnGPT telephone menus", () => {
  it("checks the exact scripts and WAV bytes for every language and caches the verified pack", async () => {
    const manifest = pack();
    fetchMock.mockImplementation(async (url: URL) => new Response(url.pathname.endsWith("manifest.json") ? JSON.stringify(manifest) : new Uint8Array(audio)));
    const { inspectIvrPrompts } = await import("./ivr-prompts");
    expect(await inspectIvrPrompts(["en-NG", "yo", "ha", "ig"], ["en-NG"])).toBe(true);
    const requests = fetchMock.mock.calls.length;
    expect(await inspectIvrPrompts(["en-NG", "yo", "ha", "ig"], ["en-NG"])).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(requests);
    expect(fetchMock.mock.calls.some(([url]) => url.pathname.endsWith("ig/consent.wav"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.pathname.endsWith("en-NG/history-choice.wav"))).toBe(true);
  });
  it.each(["missing", "changed-script", "corrupt-audio", "different-model"])("keeps calling unavailable for a %s prompt pack", async (failure) => {
    const manifest = pack();
    if (failure === "missing") delete manifest.files["yo/consent.wav"];
    if (failure === "changed-script") manifest.files["yo/consent.wav"].scriptHash = "0".repeat(64);
    if (failure === "different-model") manifest.model = "other-model";
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname.endsWith("manifest.json")) return new Response(JSON.stringify(manifest));
      if (failure === "corrupt-audio" && url.pathname.endsWith("yo/consent.wav")) return new Response("broken audio");
      return new Response(new Uint8Array(audio));
    });
    const { inspectIvrPrompts } = await import("./ivr-prompts");
    expect(await inspectIvrPrompts(["en-NG", "yo", "ha", "ig"], [])).toBe(false);
  });
  it("rejects insecure or credential-bearing prompt origins without fetching", async () => {
    vi.stubEnv("IVR_PROMPT_BASE_URL", "https://user:secret@audio.example.test/ivr/");
    const { inspectIvrPrompts } = await import("./ivr-prompts");
    expect(await inspectIvrPrompts(["en-NG"], [])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
