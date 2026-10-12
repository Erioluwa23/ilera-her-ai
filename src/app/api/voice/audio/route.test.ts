import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeViaYarnSpace } from "@/lib/natlas-space";
vi.mock("@/lib/natlas-space",()=>({synthesizeViaYarnSpace:vi.fn()}));
import { AsrError } from "@/lib/asr-contract";
import { POST } from "./route";
const request = (body: unknown, origin="https://app") => new Request("https://app/api/voice/audio", {method:"POST",headers:{origin},body:JSON.stringify(body)});
describe("saved reply audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(synthesizeViaYarnSpace).mockResolvedValue(Buffer.from("RIFFtestWAVEaudio"));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it("rejects cross-site generation", async () => {
    expect((await POST(request({text:"Hello",language:"en-NG"},"https://other"))).status).toBe(403);
  });
  it.each(["en-NG", "yo", "ig", "ha"])("uses YarnGPT2b for %s even with an old provider override", async language => {
    vi.stubEnv("VOICE_TTS_API_URL","https://speech.example/synthesize");
    vi.stubEnv("VOICE_TTS_LANGUAGES","en-NG");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response=await POST(request({text:"Hello",language}));
    expect(response.status).toBe(200); expect(response.headers.get("x-speech-model")).toBe("saheedniyi/YarnGPT2b");
    expect(response.headers.get("x-speech-language")).toBe(language);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(synthesizeViaYarnSpace).toHaveBeenCalledWith("Hello", language, expect.any(AbortSignal));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("accepts the public Render origin behind its TLS proxy and still rejects foreign origins", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL","https://app"); vi.stubEnv("VOICE_TTS_API_URL","");
    const request = (origin: string) => new Request("http://internal-host/api/voice/audio", {method:"POST",headers:{origin},body:'{}'});
    expect((await POST(request("https://app"))).status).toBe(400);
    expect((await POST(request("https://other"))).status).toBe(403);
  });
  it("rejects unsupported languages before contacting the model", async () => {
    expect((await POST(request({text:"Hello",language:"fr"}))).status).toBe(400);
    expect(synthesizeViaYarnSpace).not.toHaveBeenCalled();
  });
  it("reports the shared GPU quota clearly",async()=>{
    vi.stubEnv("VOICE_TTS_API_URL","");
    vi.mocked(synthesizeViaYarnSpace).mockRejectedValueOnce(new AsrError("ASR_QUOTA",429,"Quota exhausted"));
    const response = await POST(request({text:"Hello",language:"ha"}));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("TTS_QUOTA");
  });
  it("exposes the provider deadline and WAT retry message for YarnGPT", async () => {
    vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-10-12T07:49:42.000Z"));
    vi.mocked(synthesizeViaYarnSpace).mockRejectedValueOnce(new AsrError("ASR_QUOTA",429,"Quota exhausted","2026-10-12T09:13:27.000Z"));
    const response=await POST(request({text:"Hello",language:"en-NG"}));
    expect(response.headers.get("retry-after")).toBe("5025");
    expect(await response.json()).toMatchObject({code:"TTS_QUOTA",retryAt:"2026-10-12T09:13:27.000Z",
      error:"Quota exhausted. Try again at 12 Oct, 10:13:27 AM WAT."});
  });
  it("reports model failures without secrets or advice to use device speech", async () => {
    vi.mocked(synthesizeViaYarnSpace).mockRejectedValueOnce(new Error("hf_private-upstream-error"));
    const response = await POST(request({text:"Hello",language:"en-NG"}));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain("TTS_UNAVAILABLE");
    expect(body).not.toContain("hf_private"); expect(body).not.toContain("device");
  });
});
