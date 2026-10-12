// Hugging Face reports the wait as a Python timedelta: H:MM:SS, optionally
// prefixed with a day count. Extract only that delay, never upstream HTML,
// credential text, links, or user data.
export function quotaRetryAt(message: unknown, now = Date.now()): string | undefined {
  if (typeof message !== "string" || !Number.isFinite(now)) return;
  const plain = message.slice(0, 12000).replace(/<[^>]*>/g, " ");
  const match = /try\s+again\s+in\s+(?:(\d{1,3})\s+days?,?\s*)?(\d{1,3}):([0-5]\d):([0-5]\d(?:\.\d{1,6})?)(?=[\s.<]|$)/i.exec(plain);
  if (!match) return;
  const seconds = Number(match[1] || 0) * 86400 + Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
  // Zero, negative, malformed or implausible waits must not invent a reset.
  if (!(seconds > 0 && seconds <= 7 * 86400)) return;
  return new Date(now + Math.ceil(seconds * 1000)).toISOString();
}

export function validRetryAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return;
  const time = Date.parse(value);
  if (Number.isFinite(time)) return new Date(time).toISOString();
}

export function formatQuotaTime(retryAt: string): string {
  const parts = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  }).formatToParts(new Date(retryAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || "";
  return `${part("day")} ${part("month")}, ${part("hour")}:${part("minute")}:${part("second")} ${part("dayPeriod").toUpperCase()} WAT`;
}

export function quotaResponse(code: string, retryAt?: string): Response {
  const retry = validRetryAt(retryAt);
  const seconds = retry ? Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : undefined;
  return Response.json({
    code,
    error: retry ? `Quota exhausted. Try again at ${formatQuotaTime(retry)}.` : "Quota exhausted. Please try again later.",
    ...(retry ? { retryAt: retry, retryAfterSeconds: seconds } : {}),
  }, { status: 429, headers: {
    "cache-control": "private, no-store",
    ...(seconds !== undefined ? { "retry-after": String(seconds) } : {}),
  } });
}
