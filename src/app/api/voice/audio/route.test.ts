vi.mock("@/lib/request-session", () => ({
  requestSession: vi.fn(async () => ({ sub: "fixture" })),
}));
import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesizeViaYarnSpace } from "@/lib/natlas-space";
vi.mock("@/lib/natlas-space", () => ({ synthesizeViaYarnSpace: vi.fn() }));
import { AsrError } from "@/lib/asr-contract";
import { POST } from "./route";
const request = (body: unknown, origin = "https://app") =>
  new Request("https://app/api/voice/audio", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(body),
  });
describe("saved reply audio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("rejects cross-site generation", async () => {
    expect(
      (
        await POST(
          request({ text: "Hello", language: "en-NG" }, "https://other"),
        )
      ).status,
    ).toBe(403);
  });
  it("uses YarnGPT2b by default", async () => {
    vi.stubEnv("VOICE_TTS_API_URL", "");
    vi.mocked(synthesizeViaYarnSpace).mockResolvedValue(
      Buffer.from("RIFFtestWAVE"),
    );
    const response = await POST(request({ text: "Hello", language: "en-NG" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-speech-model")).toBe("saheedniyi/YarnGPT2b");
  });
  it("accepts the public Render origin behind its TLS proxy and still rejects foreign origins", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://app");
    vi.stubEnv("VOICE_TTS_API_URL", "");
    const request = (origin: string) =>
      new Request("http://internal-host/api/voice/audio", {
        method: "POST",
        headers: { origin },
        body: "{}",
      });
    expect((await POST(request("https://app"))).status).toBe(400);
    expect((await POST(request("https://other"))).status).toBe(403);
  });
  it("fetches only the configured provider and returns private non-cached audio", async () => {
    vi.stubEnv("VOICE_TTS_API_URL", "https://speech.example/synthesize");
    vi.stubEnv("VOICE_TTS_LANGUAGES", "yo");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "audio/mpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(
      request({
        text: "Ẹ káàárọ̀",
        language: "yo",
        url: "https://evil.example",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://speech.example/synthesize",
    );
  });
  it("reports the shared GPU quota clearly", async () => {
    vi.stubEnv("VOICE_TTS_API_URL", "");
    vi.mocked(synthesizeViaYarnSpace).mockRejectedValueOnce(
      new AsrError("ASR_QUOTA", 429, "Quota exhausted"),
    );
    expect(
      (await POST(request({ text: "Hello", language: "ha" }))).status,
    ).toBe(429);
  });
  it("rejects unexpected provider content", async () => {
    vi.stubEnv("VOICE_TTS_API_URL", "https://speech.example");
    vi.stubEnv("VOICE_TTS_LANGUAGES", "en-NG");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("bad", { headers: { "content-type": "text/html" } }),
        ),
    );
    expect(
      (await POST(request({ text: "Hello", language: "en-NG" }))).status,
    ).toBe(502);
  });
});
