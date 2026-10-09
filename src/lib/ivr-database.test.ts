import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pool: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    constructor(options: unknown) {
      mocks.pool(options);
    }
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.stubEnv("IVR_DATABASE_URL", "");
  vi.stubEnv("DATABASE_URL", "");
});
describe("IVR database selection", () => {
  it("shares the app database when no separate IVR connection is supplied", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://app-test");
    const { database } = await import("./ivr-jobs");
    database();
    expect(mocks.pool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: "postgresql://app-test" }),
    );
  });
  it("honours a separate IVR database without replacing the app connection", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://app-test");
    vi.stubEnv("IVR_DATABASE_URL", "postgresql://phone-test");
    const { database } = await import("./ivr-jobs");
    database();
    expect(mocks.pool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: "postgresql://phone-test" }),
    );
  });
  it("fails closed if neither connection is configured", async () => {
    const { database } = await import("./ivr-jobs");
    expect(() => database()).toThrow("IVR database not configured");
    expect(mocks.pool).not.toHaveBeenCalled();
  });
});
