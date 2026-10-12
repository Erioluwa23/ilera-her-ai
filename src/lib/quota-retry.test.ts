import { afterEach, describe, expect, it, vi } from "vitest";
import { formatQuotaTime, quotaResponse, quotaRetryAt, validRetryAt } from "./quota-retry";
import { quotaNotice, uiText } from "./ui-language";

const now = Date.parse("2026-10-12T07:49:42.000Z");
afterEach(() => vi.restoreAllMocks());
describe("provider-supplied quota retry time", () => {
  it("uses Hugging Face's actual delay rather than assuming midnight", () => {
    const retry = quotaRetryAt("You have exceeded your GPU quota (60s requested vs. 0s left). Try again in 2:05:06. Authenticate with a token.", now);
    expect(retry).toBe("2026-10-12T09:54:48.000Z");
    expect(formatQuotaTime(retry!)).toBe("12 Oct, 10:54:48 AM WAT");
  });
  it("handles Python timedelta day counts, fractional seconds and a WAT date rollover", () => {
    expect(quotaRetryAt("Quota exhausted. Try again in 1 day, 0:00:00.250000.", now)).toBe("2026-10-13T07:49:42.250Z");
    expect(formatQuotaTime("2026-10-12T23:30:00.000Z")).toBe("13 Oct, 12:30:00 AM WAT");
  });
  it.each([
    "GPU quota exceeded", "Try again in 0:00:00", "Try again in -1:00:00",
    "Try again in 1:99:00", "Try again in 999:00:00", "Try again in tomorrow",
  ])("does not invent a deadline for %s", message => {
    expect(quotaRetryAt(message, now)).toBeUndefined();
  });
  it("returns only a validated deadline, never upstream HTML or credential text", () => {
    const retry = quotaRetryAt("<p>GPU quota exceeded. Try again in <b>0:01:00</b>. hf_private-token</p>", now);
    expect(retry).toBe("2026-10-12T07:50:42.000Z");
    expect(validRetryAt("<script>private</script>")).toBeUndefined();
    expect(validRetryAt("not-a-date")).toBeUndefined();
  });
  it("returns an ISO deadline and a Retry-After header without caching the error", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const response = quotaResponse("TTS_QUOTA", "2026-10-12T07:50:42.000Z");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({code:"TTS_QUOTA", retryAt:"2026-10-12T07:50:42.000Z", retryAfterSeconds:60,
      error:"Quota exhausted. Try again at 12 Oct, 8:50:42 AM WAT."});
    const unknown = quotaResponse("ASR_QUOTA");
    expect(unknown.headers.get("retry-after")).toBeNull();
    expect((await unknown.json()).retryAt).toBeUndefined();
  });
  it.each(["en-NG", "yo", "ha", "ig"] as const)("formats the deadline in a %s interface without leaving template text", language => {
    const text = quotaNotice("2026-10-12T15:45:30.000Z", key => uiText(key, language));
    expect(text).toContain("12 Oct, 4:45:30 PM WAT");
    expect(text).not.toContain("{time}");
  });
});
