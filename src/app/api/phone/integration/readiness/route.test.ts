import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), inspect: vi.fn(), schema: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/natlas-space", () => ({ inspectNatlasSpace: mocks.inspect }));
vi.mock("@/lib/phone-pilot", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/phone-pilot")>(), ensurePhoneSchema: mocks.schema,
}));
import { GET } from "./route";

function request(key = "i".repeat(40)) {
  return new Request("https://app.example/api/phone/integration/readiness", { headers: { authorization: "Bearer " + key } });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("PHONE_INTEGRATION_KEY", "i".repeat(40));
  vi.stubEnv("SIM_PHONE_NUMBER", "+2348012345678");
  vi.stubEnv("SIM_PHONE_ENABLED", "false"); vi.stubEnv("SIM_PHONE_VERIFIED", "false");
  vi.stubEnv("VOICE_TTS_API_URL", ""); vi.stubEnv("NATLAS_LLM_API_URL", "");
  mocks.schema.mockResolvedValue(undefined);
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.inspect.mockResolvedValue({ reachable: true, gatedModelsAccessible: true, modelsLoaded: true,
    ttsLoaded: true, llmLoaded: false, llmAccess: false, llmFailureCategory: "access" });
});

describe("private SIM setup diagnostics", () => {
  it("requires the integration secret before querying the database or runtime", async () => {
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401); expect(mocks.schema).not.toHaveBeenCalled(); expect(mocks.inspect).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("+2348012345678");
  });
  it("lets the operator verify the number while the pilot is paused, without inferring speech quota", async () => {
    const response = await GET(request()); const data = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(data.phoneNumber).toBe("+2348012345678"); expect(data.publicReady).toBe(false);
    expect(data.blockers).toContain("pilot_paused"); expect(data.blockers).toContain("inbound_call_unverified");
    expect(data.models).toMatchObject({ textLoaded: false, textAccess: false, textFallback: "curated", speechComputeTested: false });
  });
  it("requires a recent actual gateway and restricts languages to reviewed prompts and configured speech", async () => {
    vi.stubEnv("SIM_PHONE_ENABLED", "true"); vi.stubEnv("SIM_PHONE_VERIFIED", "true");
    vi.stubEnv("VOICE_TTS_API_URL", "https://speech.example"); vi.stubEnv("VOICE_TTS_LANGUAGES", "yo");
    mocks.query.mockResolvedValue({ rows: [{ gateway_ready: true, recent: false, languages: ["yo", "ha", "invalid"], checked_at: new Date("2026-10-10T12:00:00Z") }] });
    let data = await (await GET(request())).json(); expect(data.publicReady).toBe(false); expect(data.languages).toEqual(["yo"]);
    expect(data.gateway.languages).toEqual(["yo", "ha"]);
    mocks.query.mockResolvedValue({ rows: [{ gateway_ready: true, recent: true, languages: ["yo"] }] });
    data = await (await GET(request())).json(); expect(data.publicReady).toBe(true);
    expect(data.models.speechLoaded).toBeNull(); expect(data.models.speechComputeTested).toBe(false);
  });
  it("reports unavailable checks without exposing provider exceptions or secrets", async () => {
    mocks.schema.mockRejectedValue(new Error("database-password-private"));
    mocks.inspect.mockRejectedValue(new Error("hf_private-credential"));
    const response = await GET(request()); const text = await response.text(); const data = JSON.parse(text);
    expect(data.gateway.checked).toBe(false); expect(data.models.checked).toBe(false);
    expect(data.blockers).toContain("gateway_status_unavailable");
    expect(text).not.toContain("database-password"); expect(text).not.toContain("hf_private");
  });
});
