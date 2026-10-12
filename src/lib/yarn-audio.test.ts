import { afterEach, describe, expect, it, vi } from "vitest";
import { requestYarnAudio, YARN_TTS_MODEL } from "./yarn-audio";

afterEach(() => vi.unstubAllGlobals());
function response(language = "yo", model = YARN_TTS_MODEL, type = "audio/wav") {
  return new Response(new Uint8Array([1, 2, 3]), { headers: {
    "content-type": type, "x-speech-model": model, "x-speech-language": language,
  } });
}
describe("verified YarnGPT listening requests", () => {
  it("sends the selected language and cancellation signal to the existing audio route", async () => {
    const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    expect((await requestYarnAudio("Ẹ káàárọ̀", "yo", controller.signal)).size).toBe(3);
    expect(fetcher).toHaveBeenCalledWith("/api/voice/audio", expect.objectContaining({
      body: JSON.stringify({ text: "Ẹ káàárọ̀", language: "yo" }), signal: controller.signal,
    }));
  });
  it.each([
    ["ha", YARN_TTS_MODEL, "audio/wav"],
    ["yo", "different-speaker", "audio/wav"],
    ["yo", YARN_TTS_MODEL, "text/html"],
  ])("rejects mismatched language/model/audio type %s %s %s", async (language, model, type) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(language, model, type)));
    await expect(requestYarnAudio("Text", "yo")).rejects.toMatchObject({ key: "voiceUnavailable" });
  });
  it("reports quota without using another voice", async () => {
    const speak = vi.fn(); vi.stubGlobal("speechSynthesis", { speak });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    await expect(requestYarnAudio("Text", "ig")).rejects.toMatchObject({ key: "speechQuota" });
    expect(speak).not.toHaveBeenCalled();
  });
});
