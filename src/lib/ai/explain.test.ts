import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { explain, resetExplanationCircuit } from "./explain";
import { recordResult } from "../health/record-result";
import { validateExplanation } from "../health/result-schema";
const result = recordResult(
  "period",
  "test-v1",
  [],
  [
    {
      id: "length",
      value: 29,
      unit: "days",
      displayToken: "29 days",
      basis: "Recorded interval",
      estimated: false,
    },
  ],
  "Saved guidance",
);
result.status = "ready";
result.evidenceIds = ["source"];
const draft = {
  language: "en-NG",
  headline: "Your recorded dates",
  paragraphs: [
    {
      text: "The recorded interval is {fact:length}. Period dates alone cannot confirm ovulation.",
      factIds: ["length"],
      evidenceIds: ["source"],
    },
  ],
  followUpQuestionId: null,
};
const success = (provider: "groq" | "openai", content: unknown = draft) =>
  Response.json(
    provider === "groq"
      ? {
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(content) },
            },
          ],
        }
      : {
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(content) }],
            },
          ],
        },
  );
const packet = {
  result,
  question: "Explain my recorded dates",
  evidence: [{ id: "source", text: "Recorded intervals describe past dates." }],
};
beforeEach(() => {
  resetExplanationCircuit();
  vi.stubEnv("GROQ_API_KEY", "fixture-primary");
  vi.stubEnv("OPENAI_API_KEY", "fixture-fallback");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("provider and authority contracts A1–A6 (mocked)", () => {
  it("respects fallback rate-limit cooldown without retrying either throttled provider", async () => {
    const f = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("", { status: 429, headers: { "retry-after": "120" } }),
      );
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("curated");
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("curated");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("uses only Groq on primary success and renders application facts", async () => {
    const fetcher = vi.fn().mockResolvedValue(success("groq"));
    const response = await explain(
      packet,
      "Saved guidance",
      undefined,
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(response.provider).toBe("groq");
    expect(response.paragraphs[0]).toContain("29 days");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.response_format.json_schema.strict).toBe(true);
  });
  it.each([429, 500, 401])(
    "falls back exactly once after primary HTTP %s",
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("private upstream error", { status }),
        )
        .mockResolvedValueOnce(success("openai"));
      const r = await explain(packet, "Saved guidance", undefined, fetcher);
      expect(r.provider).toBe("openai");
      expect(fetcher).toHaveBeenCalledTimes(2);
      const body = JSON.parse(fetcher.mock.calls[1][1].body);
      expect(body.store).toBe(false);
      expect(body.text.format.strict).toBe(true);
    },
  );
  it("skips missing credentials and preserves basic guidance", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const f = vi.fn();
    const r = await explain(packet, "Saved guidance", undefined, f);
    expect(f).not.toHaveBeenCalled();
    expect(r.paragraphs).toEqual(["Saved guidance"]);
  });
  it("does not use fallback to bypass a genuine refusal", async () => {
    const f = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ finish_reason: "stop", message: { refusal: "Refused" } }],
      }),
    );
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).outcome,
    ).toBe("refusal");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("falls back after malformed JSON and rejects invented numeric claims", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        success("groq", { ...draft, headline: "Take 5 mg" }),
      )
      .mockResolvedValueOnce(success("openai"));
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("openai");
  });
  it.each([
    "Pregnancy is ruled out",
    "These are safe days",
    "Your baby is healthy",
    "See https://invented.test",
    "The date is 10 October",
  ])("rejects unsupported prose: %s", (headline) =>
    expect(() => validateExplanation({ ...draft, headline }, result)).toThrow(),
  );
  it("rejects mismatched facts, sources, language and extra properties", () => {
    expect(() =>
      validateExplanation({ ...draft, language: "ha" }, result),
    ).toThrow();
    expect(() =>
      validateExplanation({ ...draft, action: "diagnose" }, result),
    ).toThrow();
    expect(() =>
      validateExplanation(
        {
          ...draft,
          paragraphs: [
            {
              text: "Use {fact:unknown}.",
              factIds: ["unknown"],
              evidenceIds: ["source"],
            },
          ],
        },
        result,
      ),
    ).toThrow();
  });
  it("rejects unknown tokens in the headline as well as paragraphs", () =>
    expect(() =>
      validateExplanation(
        { ...draft, headline: "Your value is {fact:invented}" },
        result,
      ),
    ).toThrow());
  it("respects Retry-After without attempting a second primary request", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "120" } }),
      )
      .mockImplementation(async () => success("openai"));
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("openai");
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("openai");
    expect(f.mock.calls.filter((c) => c[0].includes("groq"))).toHaveLength(1);
  });
  it("bypasses providers for urgent help in every language", async () => {
    for (const language of ["en-NG", "yo", "ha", "ig"] as const) {
      const f = vi.fn();
      const r = await explain(
        { ...packet, result: { ...result, language, careAction: "emergency" } },
        "Fixed care",
        undefined,
        f,
      );
      expect(f).not.toHaveBeenCalled();
      expect(r.paragraphs).toEqual(["Fixed care"]);
    }
  });
  it("cancels work without a fallback attempt", async () => {
    const abort = new AbortController(),
      f = vi
        .fn()
        .mockImplementation(
          (_url, init) =>
            new Promise((_resolve, reject) =>
              init.signal.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              ),
            ),
        );
    const pending = explain(packet, "Saved guidance", abort.signal, f);
    abort.abort();
    expect((await pending).outcome).toBe("cancelled");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("falls back after the primary deadline within the total budget", async () => {
    vi.stubEnv("AI_GROQ_TIMEOUT_MS", "15");
    const f = vi
      .fn()
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("timeout", "TimeoutError")),
            ),
          ),
      )
      .mockResolvedValueOnce(success("openai"));
    expect(
      (await explain(packet, "Saved guidance", undefined, f)).provider,
    ).toBe("openai");
  });
});
