import { answerQuestion, evidenceFor, localizeHealthAnswer } from "./knowledge";
import { normalizeLanguage } from "./languages";
import { NatlasLLMProvider } from "./natlas";
import { parseConversation } from "./voice-chat";

// Shared by web chat and the authenticated phone adapter; safety rules stay identical.
export async function voiceAnswer(question: string, languageValue: string, context?: unknown, signal?: AbortSignal) {
  const language = normalizeLanguage(languageValue);
  const conversation = parseConversation(context);
  const reported = conversation.filter(turn => turn.role === "user").map(turn => turn.content);
  const current = answerQuestion(question, language);
  const candidates = [...reported.map(text => answerQuestion(text, language)), current];
  const combined = reported.map(text => answerQuestion(`${text}\n${question}`, language));
  const grounded = [...candidates, ...combined].find(answer => answer.urgency === "urgent") ||
    (current.topic !== "unknown" ? current : [...candidates].reverse().find(answer => answer.topic !== "unknown") || current);
  const localized = localizeHealthAnswer(grounded, language);
  try {
    if (grounded.urgency === "urgent") throw new Error("Preserving source-grounded urgent guidance");
    const generated = await new NatlasLLMProvider().answer(question, { ...evidenceFor(grounded), conversation }, language, signal);
    return { ...localized, answer: generated.text, language, model: "n-atlas" as const, natlasAvailable: true, natlasError: undefined,
      generationModel: generated.model, generationProvider: generated.provider };
  } catch (error) {
    return { ...localized, language, model: "curated" as const, natlasAvailable: false,
      natlasError: error instanceof Error ? error.message : "N-ATLAS inference failed.", generationModel: null, generationProvider: "curated" };
  }
}
