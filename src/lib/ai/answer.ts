import {
  answerQuestion,
  evidenceFor,
  localizeHealthAnswer,
  type HealthAnswer,
} from "../knowledge";
import { NatlasLLMProvider } from "../natlas";
import { explain } from "./explain";
import { todayIn } from "../health/date-only";
import type { ConversationTurn } from "../voice-chat";
import type { IlaraLanguage } from "../languages";
import type { HealthResult } from "../health/result-schema";
import { possibleDangerReport } from "../health/danger-report";
export async function explainAnswer(
  question: string,
  language: IlaraLanguage,
  conversation: ConversationTurn[],
  allowExternal: boolean,
  signal?: AbortSignal,
  currentEpisode: "yes" | "no" | "unknown" = "unknown",
) {
  const current = answerQuestion(question, language),
    reported = conversation
      .filter((x) => x.role === "user")
      .map((x) => x.content);
  const historicalCurrentReport =
    current.urgency === "urgent" &&
    currentEpisode !== "yes" &&
    language === "en-NG" &&
    /\b(?:last year|last month|used to|history of|previously|years? ago)\b/i.test(
      question,
    ) &&
    !/\b(?:now|currently)\b/i.test(question);
  if (historicalCurrentReport) current.urgency = "attention";
  const previous = reported.map((q) => answerQuestion(q, language)),
    combined = reported.map((q) =>
      answerQuestion(q + "\n" + question, language),
    );
  const urgentContext = [...previous, ...combined].find(
    (a) => a.urgency === "urgent",
  );
  const explicitCurrentReport =
    possibleDangerReport(question, language) &&
    (currentEpisode === "yes" ||
      (language === "en-NG" && /\b(?:now|currently|i feel)\b/i.test(question)));
  const grounded: HealthAnswer =
    current.urgency === "urgent"
      ? current
      : (currentEpisode === "yes" || explicitCurrentReport) && urgentContext
        ? urgentContext
        : current.topic !== "unknown"
          ? current
          : [...previous].reverse().find((a) => a.topic !== "unknown") ||
            current;
  const needsCurrentConfirmation =
    historicalCurrentReport ||
    (!!urgentContext &&
      current.urgency !== "urgent" &&
      currentEpisode !== "yes" &&
      !explicitCurrentReport);
  // A saved warning does not establish a current emergency. Keep conditional help and ask for confirmation.
  if (needsCurrentConfirmation) grounded.urgency = "attention";
  const localized = localizeHealthAnswer(grounded, language),
    evidenceIds = grounded.sources.map((_, i) => "legacy-source-" + i);
  const result: HealthResult = {
    schemaVersion: "health-result-v1",
    topic:
      grounded.topic === "fertility-awareness"
        ? "fertility"
        : grounded.topic === "irregular"
          ? "late_period"
          : "period",
    language,
    status: "ready",
    careAction:
      grounded.urgency === "urgent"
        ? "emergency"
        : grounded.urgency === "attention"
          ? "appointment"
          : "general_information",
    facts: [],
    calculation: {
      methodVersion: "existing-guidance-v1",
      policyVersion: "existing-safety-v1",
      asOfDate: todayIn(),
      recordIds: [],
      eligibilityReasons: [],
      referenceVersion: null,
    },
    fixedMessageIds: [grounded.topic],
    evidenceIds,
    allowedActionIds: ["help", "track"],
    allowedQuestionIds: [],
    explanation: null,
  };
  if (needsCurrentConfirmation) {
    result.status = "needs_input";
    result.careAction = "needs_clarification";
    result.calculation.eligibilityReasons = [
      "earlier_symptoms_not_confirmed_current",
    ];
  }
  let generationProvider = "curated",
    generationModel: string | null = null,
    text = localized.answer,
    generated = false;
  if (
    allowExternal &&
    grounded.urgency !== "urgent" &&
    !needsCurrentConfirmation
  ) {
    if (process.env.AI_PROVIDER_MODE === "natlas") {
      try {
        const response = await new NatlasLLMProvider().answer(
          question,
          { ...evidenceFor(grounded), conversation },
          language,
        );
        text = response.text;
        generationProvider = "natlas";
        generationModel = response.model;
        generated = true;
      } catch {
        /* Existing guidance remains usable. */
      }
    } else {
      const response = await explain(
        {
          result,
          question,
          evidence: evidenceIds.map((id, i) => ({
            id,
            text:
              grounded.sources[i].title +
              ": " +
              grounded.answer +
              " " +
              grounded.nextSteps.join(" "),
          })),
        },
        localized.answer,
        signal,
      );
      text = response.paragraphs.join("\n\n");
      generationProvider = response.provider;
      generationModel = response.model;
      generated = response.generated;
    }
  }
  result.explanation = {
    provider: generationProvider as "curated" | "natlas" | "groq" | "openai",
    model: generationModel,
    promptVersion: "explanation-v1",
    generated,
    headline: "",
    paragraphs: [text],
  };
  return {
    ...localized,
    answer: text,
    language,
    model: generationProvider === "natlas" ? "n-atlas" : generationProvider,
    natlasAvailable: generationProvider === "natlas",
    aiAvailable: generated,
    generationProvider,
    generationModel,
    healthResult: result,
  };
}
