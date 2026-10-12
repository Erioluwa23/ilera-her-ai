import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as credentials from "./hf-token";
import { quotaLimitFromError, quotaResetFromMetadata, zeroGpuRetryAt } from "./hf-quota";

const now = Date.parse("2026-10-12T13:30:00.000Z");
const reset = "2026-10-12T18:12:03.000Z";
const quota = { base: 300, current: -12, resetsAt: reset, overquotaUsed: 0 };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("official ZeroGPU reset metadata", () => {
  it("uses the API's absolute reset even when the error has no countdown", () => {
    expect(quotaResetFromMetadata(quota, "gpu", now)).toBe(reset);
    expect(quotaResetFromMetadata({ ...quota, current: 12 }, "gpu", now)).toBe(reset);
  });
  it("uses execution-count reset for runs limits, including a different daily time", () => {
    const runs = { used: 20, limit: 20, remaining: 0, resetsAt: "2026-10-12T20:00:00Z" };
    expect(quotaResetFromMetadata({ ...quota, current: 200, runs }, "runs", now)).toBe("2026-10-12T20:00:00.000Z");
    expect(quotaResetFromMetadata({ ...quota, runs }, "gpu", now)).toBe("2026-10-12T20:00:00.000Z");
    expect(quotaResetFromMetadata({ ...quota, runs: { ...runs, resetsAt: null } }, "gpu", now)).toBeUndefined();
  });
  it.each([null, [], {}, { ...quota, resetsAt: null }, { ...quota, resetsAt: "2026-10-12T12:00:00Z" },
    { ...quota, resetsAt: "not-a-date" }, { ...quota, resetsAt: "2026-11-12T18:12:03Z" }, { ...quota, current: "0" }])(
    "does not invent renewal times from missing or invalid metadata %#", value => {
      expect(quotaResetFromMetadata(value, "gpu", now)).toBeUndefined();
    });
  it("does not use a healthy account's daily reset for an unidentified quota failure", () => {
    expect(quotaResetFromMetadata({ ...quota, current: 200 }, "unknown", now)).toBeUndefined();
    expect(quotaResetFromMetadata(quota, "unknown", now)).toBe(reset);
  });
  it("distinguishes GPU, runs, unrelated rate limits and Space-wide limits", () => {
    expect(quotaLimitFromError(new Error("GPU quota exceeded"))).toBe("gpu");
    expect(quotaLimitFromError({ message: "ZeroGPU runs limit reached" })).toBe("runs");
    expect(quotaLimitFromError(new Error("Quota exhausted"))).toBe("unknown");
    expect(quotaLimitFromError(new Error("Rate limit exceeded (429)"))).toBeUndefined();
    expect(quotaLimitFromError(new Error("This Space app has reached its GPU limit"))).toBeUndefined();
  });
});

describe("authenticated quota lookup", () => {
  beforeEach(() => {
    vi.spyOn(credentials, "huggingFaceToken").mockReturnValue("hf_test-only");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  it("uses the fixed official endpoint and server credential, returning only the timestamp", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(quota));
    vi.stubGlobal("fetch", fetcher);
    expect(await zeroGpuRetryAt("gpu")).toBe(reset);
    expect(fetcher).toHaveBeenCalledWith("https://huggingface.co/api/spaces/zero-gpu/quota", expect.objectContaining({
      cache: "no-store", redirect: "error", headers: { Authorization: "Bearer hf_test-only" }, signal: expect.any(AbortSignal),
    }));
    expect(console.warn).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])("preserves the generic quota error if lookup returns %s, without leaking the body", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("hf_private-account-details", { status })));
    expect(await zeroGpuRetryAt("gpu")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith("[ZeroGPU quota lookup]", { status });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("hf_private");
  });
  it("skips unauthenticated and cancelled lookups", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    vi.mocked(credentials.huggingFaceToken).mockReturnValue(undefined);
    expect(await zeroGpuRetryAt("gpu")).toBeUndefined();
    vi.mocked(credentials.huggingFaceToken).mockReturnValue("hf_test-only");
    expect(await zeroGpuRetryAt("gpu", AbortSignal.abort())).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps network and malformed JSON failures from replacing the original quota error", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("hf_secret"))
      .mockResolvedValueOnce(new Response("{", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await zeroGpuRetryAt("gpu")).toBeUndefined();
    expect(await zeroGpuRetryAt("gpu")).toBeUndefined();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("hf_secret");
  });
});
