import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptCycle, encryptCycle } from "./encryption";
afterEach(() => vi.unstubAllEnvs());
describe("private cycle payloads", () => {
  const value = { startDate: "2026-10-01", notes: "Private note" };
  it("encrypts dates/notes with fresh nonces and authenticated owner/type binding", () => {
    vi.stubEnv("CYCLE_DATA_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    const a = encryptCycle(value, "1", "period:a"),
      b = encryptCycle(value, "1", "period:a");
    expect(a).not.toBe(b);
    expect(a).not.toContain(value.startDate);
    expect(a).not.toContain(value.notes);
    expect(decryptCycle(a, "1", "period:a")).toEqual(value);
    expect(() => decryptCycle(a, "2", "period:a")).toThrow();
    expect(() => decryptCycle(a, "1", "prediction:a")).toThrow();
    const parts = a.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptCycle(parts.join("."), "1", "period:a")).toThrow();
  });
  it("fails closed rather than storing plaintext if the key is absent", () => {
    vi.stubEnv("CYCLE_DATA_ENCRYPTION_KEY", "");
    expect(() => encryptCycle(value, "1", "period:a")).toThrow();
  });
  it("rejects truncated authentication tags", () => {
    vi.stubEnv("CYCLE_DATA_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    const parts = encryptCycle(value, "1", "period:a").split(".");
    parts[2] = Buffer.from("short").toString("base64");
    expect(() => decryptCycle(parts.join("."), "1", "period:a")).toThrow();
  });
});
