import type { HealthResult } from "./result-schema";
import { todayIn } from "./date-only";
export function recordResult(
  topic: HealthResult["topic"],
  method: string,
  ids: string[],
  facts: HealthResult["facts"],
  explanation: string,
  reasons: string[] = [],
): HealthResult {
  return {
    schemaVersion: "health-result-v1",
    topic,
    language: "en-NG",
    status: "record_only",
    careAction: "general_information",
    facts,
    calculation: {
      methodVersion: method,
      policyVersion: "record-arithmetic-v1",
      asOfDate: todayIn(),
      recordIds: ids,
      eligibilityReasons: reasons,
      referenceVersion: null,
    },
    fixedMessageIds: [],
    evidenceIds: [],
    allowedActionIds: ["history", "help"],
    allowedQuestionIds: [],
    explanation: {
      provider: "curated",
      model: null,
      promptVersion: "record-template-v1",
      generated: false,
      headline: "",
      paragraphs: [explanation],
    },
  };
}
