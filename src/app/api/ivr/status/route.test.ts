import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  runtime: vi.fn(),
  numbers: vi.fn(),
}));
vi.mock("@/lib/ivr-jobs", () => ({ databaseReady: mocks.database }));
vi.mock("@/lib/natlas-space", () => ({ inspectNatlasSpace: mocks.runtime }));
vi.mock("twilio", () => ({
  default: () => ({ incomingPhoneNumbers: { list: mocks.numbers } }),
}));
import { GET } from "./route";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    IVR_ENABLED: "true",
    TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
    TWILIO_AUTH_TOKEN: "auth",
    IVR_PHONE_NUMBER: "+2348012345678",
    IVR_PUBLIC_BASE_URL: "https://ivr.example.test",
    IVR_SESSION_SECRET: "secret".repeat(8),
    IVR_DATABASE_URL: "postgresql://test",
  }))
    vi.stubEnv(key, value);
  mocks.database.mockResolvedValue(true);
  mocks.runtime.mockResolvedValue({
    reachable: true,
    gatedModelsAccessible: true,
    modelsLoaded: true,
    llmLoaded: true,
  });
  mocks.numbers.mockResolvedValue([
    {
      capabilities: { voice: true },
      voiceUrl: "https://ivr.example.test/api/ivr/incoming",
      voiceMethod: "POST",
    },
  ]);
});
describe("phone availability", () => {
  it("keeps the number unpublished when the default text model is not loaded", async () => {
    mocks.runtime.mockResolvedValue({
      reachable: true,
      gatedModelsAccessible: true,
      modelsLoaded: true,
      llmLoaded: false,
    });
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.phoneNumber).toBeNull();
    expect(data.checks.llmReady).toBe(false);
  });
  it("publishes only after provider, database and default models are available", async () => {
    const data = await (await GET()).json();
    expect(data.ready).toBe(true);
    expect(data.phoneNumber).toBe("+2348012345678");
  });
  it("keeps a wrongly configured number unpublished", async () => {
    mocks.numbers.mockResolvedValue([
      {
        capabilities: { voice: true },
        voiceUrl: "https://other.example.test/api/ivr/incoming",
        voiceMethod: "POST",
      },
    ]);
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.checks.numberVerified).toBe(false);
  });
});
