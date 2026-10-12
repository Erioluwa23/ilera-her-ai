import { huggingFaceToken } from "./hf-token";
import { validRetryAt } from "./quota-retry";

type QuotaLimit = "gpu" | "runs" | "unknown";

// This is the authenticated caller's quota, using the same server token as
// Gradio. Read only the reset timestamps; never expose billing data or tokens.
export async function zeroGpuRetryAt(limit: QuotaLimit, signal?: AbortSignal): Promise<string | undefined> {
  const token = huggingFaceToken();
  if (!token || signal?.aborted) return;
  try {
    const timeout = AbortSignal.timeout(4000);
    const response = await fetch("https://huggingface.co/api/spaces/zero-gpu/quota", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      // Safe operational evidence for a missing read-billing permission. Do
      // not log the upstream response, which can contain account details.
      console.warn("[ZeroGPU quota lookup]", { status: response.status });
      return;
    }
    return quotaResetFromMetadata(await response.json(), limit);
  } catch {
    if (!signal?.aborted) console.warn("[ZeroGPU quota lookup] unavailable");
  }
}

export function quotaLimitFromError(error: unknown): QuotaLimit | undefined {
  const detail = error && typeof error === "object" && "message" in error ? error.message : error;
  const text = typeof detail === "string" ? detail.slice(0, 12000).toLowerCase() : "";
  // A Space-wide cap or Hub rate limit is not the caller's daily GPU quota.
  if (/app.*(?:gpu|zerogpu).*(?:limit|quota)|rate limit/.test(text)) return;
  if (/runs? (?:limit|quota)/.test(text)) return "runs";
  if (/(?:gpu|zerogpu).*quota|quota.*(?:gpu|zerogpu)/.test(text)) return "gpu";
  if (/quota/.test(text)) return "unknown";
}

export function quotaResetFromMetadata(value: unknown, limit: QuotaLimit, now = Date.now()): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (typeof data.current !== "number" || !Number.isFinite(data.current)) return;
  const future = (value: unknown) => {
    const date = validRetryAt(value);
    if (date && Date.parse(date) > now && Date.parse(date) <= now + 7 * 86400000) return date;
  };
  const gpu = future(data.resetsAt);
  const runs = data.runs && typeof data.runs === "object" && !Array.isArray(data.runs)
    ? data.runs as Record<string, unknown> : undefined;
  const runReset = future(runs?.resetsAt);
  const runsExhausted = typeof runs?.remaining === "number" && Number.isFinite(runs.remaining) && runs.remaining <= 0;
  const deadlines: string[] = [];
  // A GPU call can fail with positive seconds left if its requested duration
  // exceeds them. A confirmed GPU-quota error is sufficient in that case.
  if (limit === "gpu" || data.current <= 0) {
    if (!gpu) return;
    deadlines.push(gpu);
  }
  if (limit === "runs" || runsExhausted) {
    if (!runReset) return;
    deadlines.push(runReset);
  }
  // When both limits block a call, both must renew before it can be retried.
  return deadlines.sort().at(-1);
}
