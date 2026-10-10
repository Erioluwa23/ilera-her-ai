import type { IlaraLanguage } from "../languages";
import { validDate } from "./date-only";
export type HealthResult = {
  schemaVersion: "health-result-v1";
  topic:
    | "period"
    | "fertility"
    | "pregnancy"
    | "late_period"
    | "conception"
    | "newborn"
    | "growth";
  language: IlaraLanguage;
  status: "ready" | "needs_input" | "unable_to_estimate" | "record_only";
  careAction:
    | "emergency"
    | "prompt_assessment"
    | "appointment"
    | "general_information"
    | "needs_clarification";
  facts: {
    id: string;
    value: number | string | null;
    unit: string | null;
    displayToken: string;
    basis: string;
    estimated: boolean;
  }[];
  calculation: {
    methodVersion: string;
    policyVersion: string;
    asOfDate: string;
    recordIds: string[];
    eligibilityReasons: string[];
    referenceVersion: string | null;
  };
  fixedMessageIds: string[];
  evidenceIds: string[];
  allowedActionIds: string[];
  allowedQuestionIds: string[];
  explanation: null | {
    provider: "groq" | "openai" | "natlas" | "curated";
    model: string | null;
    promptVersion: string;
    generated: boolean;
    headline: string;
    paragraphs: string[];
  };
};
export type ExplanationDraft = {
  language: IlaraLanguage;
  headline: string;
  paragraphs: { text: string; factIds: string[]; evidenceIds: string[] }[];
  followUpQuestionId: string | null;
};
export const explanationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["language", "headline", "paragraphs", "followUpQuestionId"],
  properties: {
    language: { type: "string", enum: ["en-NG", "yo", "ha", "ig"] },
    headline: { type: "string" },
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "factIds", "evidenceIds"],
        properties: {
          text: { type: "string" },
          factIds: { type: "array", items: { type: "string" } },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    followUpQuestionId: { type: ["string", "null"] },
  },
};
const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const exactKeys = (x: Record<string, unknown>, keys: string[]) =>
  Object.keys(x).length === keys.length && keys.every((k) => k in x);
const allowed = (x: unknown, ids: string[]): x is string[] =>
  Array.isArray(x) &&
  x.every((id) => typeof id === "string" && ids.includes(id));
export function validateExplanation(
  value: unknown,
  result: HealthResult,
): ExplanationDraft {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      "language",
      "headline",
      "paragraphs",
      "followUpQuestionId",
    ]) ||
    value.language !== result.language ||
    typeof value.headline !== "string" ||
    !value.headline.trim() ||
    [...value.headline].length > 80 ||
    !Array.isArray(value.paragraphs) ||
    value.paragraphs.length < 1 ||
    value.paragraphs.length > 3 ||
    (value.followUpQuestionId !== null &&
      !result.allowedQuestionIds.includes(String(value.followUpQuestionId)))
  )
    throw new Error("Invalid explanation schema.");
  const facts = result.facts.map((f) => f.id);
  if (
    [...value.headline.matchAll(/\{fact:([^}]+)\}/g)].some(
      (m) => !facts.includes(m[1]),
    )
  )
    throw new Error("Unknown headline fact.");
  const texts: string[] = [value.headline];
  for (const p of value.paragraphs) {
    if (
      !isObject(p) ||
      !exactKeys(p, ["text", "factIds", "evidenceIds"]) ||
      typeof p.text !== "string" ||
      !p.text.trim() ||
      p.text.length > 1200 ||
      !allowed(p.factIds, facts) ||
      !allowed(p.evidenceIds, result.evidenceIds)
    )
      throw new Error("Invalid explanation references.");
    const tokens = [...p.text.matchAll(/\{fact:([^}]+)\}/g)].map((m) => m[1]);
    if (
      tokens.some(
        (t) => !facts.includes(t) || !(p.factIds as string[]).includes(t),
      ) ||
      p.factIds.some((t) => !tokens.includes(t))
    )
      throw new Error("Fact tokens do not match references.");
    texts.push(p.text);
  }
  const plain = texts.join(" ").replace(/\{fact:[^}]+\}/g, "");
  if (
    plain.split(/\s+/).length > 200 ||
    /[\p{N}]|https?:|www\.|\{[^}]*\}/u.test(plain) ||
    /\b(safe days?|not fertile|infertile day|cannot be pregnant|pregnancy (is )?(excluded|ruled out)|healthy baby|baby is healthy|take.*\b(mg|milligrams?|dose|tablets?)|prescrib\w*|guaranteed)\b/i.test(
      plain,
    )
  )
    throw new Error("Explanation contains an unsupported claim.");
  return value as unknown as ExplanationDraft;
}
export function renderFactTokens(text: string, result: HealthResult) {
  return text.replace(
    /\{fact:([^}]+)\}/g,
    (_, id) => result.facts.find((f) => f.id === id)!.displayToken,
  );
}
export function validateResult(result: HealthResult) {
  if (
    result.schemaVersion !== "health-result-v1" ||
    !validDate(result.calculation.asOfDate) ||
    new Set(result.facts.map((f) => f.id)).size !== result.facts.length ||
    result.facts.some(
      (f) =>
        (typeof f.value === "number" && !Number.isFinite(f.value)) ||
        !f.id ||
        !f.basis ||
        !f.displayToken,
    )
  )
    throw new Error("Invalid authoritative result.");
  return result;
}
