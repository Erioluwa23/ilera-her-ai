import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  database: vi.fn(),
  runtime: vi.fn(),
  numbers: vi.fn(),
  account: vi.fn(),
}));
vi.mock("@/lib/ivr-jobs", () => ({ databaseReady: mocks.database }));
vi.mock("@/lib/natlas-space", () => ({ inspectNatlasSpace: mocks.runtime }));
vi.mock("twilio", () => ({
  default: () => ({
    incomingPhoneNumbers: { list: mocks.numbers },
    api: { accounts: () => ({ fetch: mocks.account }) },
  }),
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
    NATLAS_LLM_API_URL: "",
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
      phoneNumber: "+2348012345678",
      capabilities: { voice: true },
      voiceUrl: "https://ivr.example.test/api/ivr/incoming",
      voiceMethod: "POST",
    },
  ]);
  mocks.account.mockResolvedValue({
    sid: "AC" + "a".repeat(32),
    type: "Full",
    status: "active",
  });
});
describe("phone availability", () => {
  it("verifies the full setup without enabling or publishing phone calls", async () => {
    vi.stubEnv("IVR_ENABLED", "false");
    vi.stubEnv("IVR_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://app-test");
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.setupReady).toBe(true);
    expect(data.checks.database).toBe(true);
    expect(data.checks.databaseReachable).toBe(true);
    expect(data.phoneNumber).toBeNull();
    expect(mocks.database).toHaveBeenCalledOnce();
    expect(mocks.runtime).toHaveBeenCalledOnce();
    expect(mocks.account).toHaveBeenCalledOnce();
    expect(mocks.numbers).toHaveBeenCalledOnce();
  });

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
    expect(data.setupReady).toBe(true);
    expect(data.phoneNumber).toBe("+2348012345678");
  });
  it("keeps a wrongly configured number unpublished", async () => {
    mocks.numbers.mockResolvedValue([
      {
        phoneNumber: "+2348012345678",
        capabilities: { voice: true },
        voiceUrl: "https://other.example.test/api/ivr/incoming",
        voiceMethod: "POST",
      },
    ]);
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.checks.numberOwned).toBe(true);
    expect(data.checks.webhookConfigured).toBe(false);
    expect(data.checks.numberVerified).toBe(false);
  });

  it("checks models and storage when provider credentials are missing", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.phoneNumber).toBeNull();
    expect(data.accountType).toBeNull();
    expect(data.checks.providerVerified).toBe(false);
    expect(data.checks.asrReachable).toBe(true);
    expect(data.checks.llmReady).toBe(true);
    expect(data.checks.databaseReachable).toBe(true);
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.numbers).not.toHaveBeenCalled();
  });

  it("distinguishes an authenticated account from a missing owned number", async () => {
    mocks.numbers.mockResolvedValue([]);
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.phoneNumber).toBeNull();
    expect(data.checks.providerVerified).toBe(true);
    expect(data.checks.numberOwned).toBe(false);
    expect(data.checks.webhookConfigured).toBe(false);
  });

  it("verifies the account before a number is configured", async () => {
    vi.stubEnv("IVR_PHONE_NUMBER", "");
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.checks.providerVerified).toBe(true);
    expect(data.checks.numberOwned).toBe(false);
    expect(mocks.account).toHaveBeenCalledOnce();
    expect(mocks.numbers).not.toHaveBeenCalled();
  });

  it.each([
    { phoneNumber: "+2348012345678", capabilities: { voice: false } },
    { phoneNumber: "+2348099999999", capabilities: { voice: true } },
  ])("keeps an unsuitable or different number unpublished: %j", async (number) => {
    mocks.numbers.mockResolvedValue([{
      ...number,
      voiceUrl: "https://ivr.example.test/api/ivr/incoming",
      voiceMethod: "POST",
    }]);
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.phoneNumber).toBeNull();
    expect(data.checks.numberOwned).toBe(false);
  });

  it.each([
    { type: "Trial", status: "active" },
    { type: "Full", status: "suspended" },
  ])("does not advertise public calling on a restricted account: %j", async (account) => {
    mocks.account.mockResolvedValue({ sid: "AC" + "a".repeat(32), ...account });
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.setupReady).toBe(false);
    expect(data.phoneNumber).toBeNull();
    expect(data.accountType).toBe(account.type);
    expect(data.checks.numberVerified).toBe(true);
    expect(data.checks.publicCallingAllowed).toBe(false);
  });

  it("keeps authentication errors private while reporting the other dependencies", async () => {
    mocks.account.mockRejectedValue(new Error("Private provider credential failure"));
    mocks.numbers.mockRejectedValue(new Error("Private provider credential failure"));
    const response = await GET();
    const data = await response.json();
    expect(data.ready).toBe(false);
    expect(data.checks.providerVerified).toBe(false);
    expect(data.checks.databaseReachable).toBe(true);
    expect(data.checks.asrReachable).toBe(true);
    expect(data.phoneNumber).toBeNull();
    expect(JSON.stringify(data)).not.toContain("Private provider");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports provider setup even when the model runtime cannot be reached", async () => {
    mocks.runtime.mockRejectedValue(new Error("Runtime unavailable"));
    const data = await (await GET()).json();
    expect(data.ready).toBe(false);
    expect(data.checks.asrReachable).toBe(false);
    expect(data.checks.llmReady).toBe(false);
    expect(data.checks.providerVerified).toBe(true);
    expect(data.checks.numberVerified).toBe(true);
    expect(data.phoneNumber).toBeNull();
  });
});
