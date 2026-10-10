import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), inspect: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ query: mocks.query }) }));
vi.mock("@/lib/phone-pilot", () => ({ ensurePhoneSchema: vi.fn(), PHONE_LANGUAGES: ["en-NG", "yo", "ha", "ig"], phoneResponse: (value: unknown) => Response.json(value) }));
vi.mock("@/lib/natlas-space", () => ({ inspectNatlasSpace: mocks.inspect }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("VOICE_TTS_API_URL", "");
  vi.stubEnv("PHONE_INTEGRATION_KEY", "key".repeat(15)); vi.stubEnv("SIM_PHONE_ENABLED", "true");
  vi.stubEnv("SIM_PHONE_NUMBER", "+2348012345678"); vi.stubEnv("SIM_PHONE_VERIFIED", "true");
  mocks.query.mockResolvedValue({ rows: [{ gateway_ready: true, languages: ["en-NG"] }] });
  mocks.inspect.mockResolvedValue({ reachable: true, gatedModelsAccessible: true, modelsLoaded: true, ttsLoaded: true });
});
describe("SIM number publication", () => {
  it("does not expose a number before physical verification", async () => {
    vi.stubEnv("SIM_PHONE_VERIFIED", "false"); expect((await (await GET()).json()).phoneNumber).toBeNull(); expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it("requires a current gateway heartbeat and only publishes available languages", async () => {
    const status = await (await GET()).json(); expect(status.ready).toBe(true); expect(status.languages).toEqual(["en-NG"]);
    mocks.query.mockResolvedValue({ rows: [] }); expect((await (await GET()).json()).phoneNumber).toBeNull();
  });
  it("does not publish the number while speech models are unavailable", async () => {
    mocks.inspect.mockResolvedValue({ reachable: true, gatedModelsAccessible: true, modelsLoaded: true, ttsLoaded: false });
    expect((await (await GET()).json()).ready).toBe(false);
  });
});
