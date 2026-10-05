import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const request = (body: unknown, origin="https://app") => new Request("https://app/api/voice/audio", {method:"POST",headers:{origin},body:JSON.stringify(body)});
describe("saved reply audio", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("rejects cross-site generation", async () => {
    expect((await POST(request({text:"Hello",language:"en-NG"},"https://other"))).status).toBe(403);
  });
  it("reports unconfigured audio without substituting a speech provider", async () => {
    vi.stubEnv("VOICE_TTS_API_URL","");
    expect((await POST(request({text:"Hello",language:"en-NG"}))).status).toBe(503);
  });
  it("accepts the public Render origin behind its TLS proxy and still rejects foreign origins", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL","https://app"); vi.stubEnv("VOICE_TTS_API_URL","");
    const request = (origin: string) => new Request("http://internal-host/api/voice/audio", {method:"POST",headers:{origin},body:'{}'});
    expect((await POST(request("https://app"))).status).toBe(503);
    expect((await POST(request("https://other"))).status).toBe(403);
  });
  it("fetches only the configured provider and returns private non-cached audio", async () => {
    vi.stubEnv("VOICE_TTS_API_URL","https://speech.example/synthesize"); vi.stubEnv("VOICE_TTS_LANGUAGES","yo");
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"audio/mpeg"}})); vi.stubGlobal("fetch",fetcher);
    const response = await POST(request({text:"Ẹ káàárọ̀",language:"yo",url:"https://evil.example"}));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(String(fetcher.mock.calls[0][0])).toBe("https://speech.example/synthesize");
  });
  it("rejects unexpected provider content", async () => {
    vi.stubEnv("VOICE_TTS_API_URL","https://speech.example"); vi.stubEnv("VOICE_TTS_LANGUAGES","en-NG");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("bad",{headers:{"content-type":"text/html"}})));
    expect((await POST(request({text:"Hello",language:"en-NG"}))).status).toBe(502);
  });
});
