import { beforeEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  schema: vi.fn(),
}));
vi.mock("./ivr-jobs", () => ({
  schema: mocks.schema,
  database: () => ({
    query: mocks.query,
    connect: async () => ({ query: mocks.query, release: mocks.release }),
  }),
}));
import {
  callerKey,
  historyEnabled,
  openHistory,
  sealHistory,
  unlockProfile,
  callerHistory,
  forgetProfile,
} from "./ivr-profiles";
import type { CallState } from "./ivr";
const state: CallState = {
  id: "12345678-1234-1234-1234-123456789abc",
  profileId: "22345678-1234-1234-1234-123456789abc",
  call: "CA" + "b".repeat(32),
  language: "en-NG",
  expires: Date.now() + 600000,
  consented: true,
};
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("IVR_PROFILE_SECRET", "long-lived-profile-secret".repeat(3));
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ rows: [] });
});
describe("private caller profiles", () => {
  it("hashes E164 identifiers and declines withheld or invalid numbers", () => {
    expect(callerKey("+2348012345678")).toMatch(/^[a-f0-9]{64}$/);
    expect(callerKey("+2348012345678")).toBe(callerKey("+2348012345678"));
    expect(callerKey("+2348012345679")).not.toBe(callerKey("+2348012345678"));
    expect(callerKey("anonymous")).toBeUndefined();
    expect(callerKey("08012345678")).toBeUndefined();
  });
  it("encrypts history with authenticated encryption and randomized nonces", () => {
    const turn = { question: "sensitive health report", answer: "guidance" };
    const a = sealHistory(turn),
      b = sealHistory(turn);
    expect(a).not.toBe(b);
    expect(a).not.toContain(turn.question);
    expect(openHistory(a)).toEqual(turn);
    const tampered = Buffer.from(a, "base64");
    tampered[30] ^= 1;
    expect(() => openHistory(tampered.toString("base64"))).toThrow();
  });
  it("requires reviewed native history prompts", () => {
    expect(historyEnabled("en-NG")).toBe(true);
    expect(historyEnabled("yo")).toBe(false);
    vi.stubEnv("IVR_HISTORY_PROMPT_LANGUAGES", "yo");
    expect(historyEnabled("yo")).toBe(true);
  });
  it("does not query history for a guest", async () => {
    expect(await callerHistory({ ...state, profileId: undefined })).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("returns bounded dated history only for an unexpired profile", async () => {
    const turn = {
      question: "a report",
      answer: "advice",
      language: "yo",
      recordedAt: "2026-10-01T00:00:00Z",
    };
    mocks.query.mockResolvedValue({ rows: [{ payload: sealHistory(turn) }] });
    expect(await callerHistory(state)).toEqual([turn]);
    expect(mocks.query.mock.calls[0][0]).toContain("p.expires_at>now()");
    expect(mocks.query.mock.calls[0][0]).toContain("LIMIT 4");
    expect(mocks.query.mock.calls[0][1]).toEqual([state.profileId]);
  });
  it("rejects a malformed PIN before accessing storage", async () => {
    expect(await unlockProfile("a".repeat(64), "123", false)).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("unlocks with the correct salted PIN and extends consented retention", async () => {
    const row = {
      id: state.profileId,
      salt: "salt",
      pin_hash: scryptSync("728394", "salt", 32).toString("hex"),
      failures: 0,
    };
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SELECT *") ? [row] : [],
    }));
    expect(await unlockProfile("a".repeat(64), "728394", false)).toBe(
      state.profileId,
    );
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("expires_at=now()+interval '30 days'"),
      ),
    ).toBe(true);
    expect(mocks.release).toHaveBeenCalled();
  });
  it("increments failed attempts persistently without returning history", async () => {
    const row = {
      id: state.profileId,
      salt: "salt",
      pin_hash: scryptSync("728394", "salt", 32).toString("hex"),
      failures: 4,
    };
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SELECT *") ? [row] : [],
    }));
    expect(await unlockProfile("a".repeat(64), "123456", false)).toBeNull();
    expect(
      mocks.query.mock.calls.some(
        ([sql]) => sql.includes("failures+1>=5") && sql.includes("15 minutes"),
      ),
    ).toBe(true);
  });
  it("rejects the correct PIN while locked", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SELECT *")
        ? [{ locked_until: new Date(Date.now() + 600000) }]
        : [],
    }));
    expect(await unlockProfile("a".repeat(64), "728394", false)).toBeNull();
  });
  it("deletes cached replies and profile under a transaction lock", async () => {
    await forgetProfile(state);
    const statements = mocks.query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("FOR UPDATE");
    expect(statements[2]).toContain("DELETE FROM ileraher_ivr_jobs");
    expect(statements[3]).toContain("DELETE FROM ileraher_ivr_profiles");
    expect(statements[4]).toBe("COMMIT");
  });
});
