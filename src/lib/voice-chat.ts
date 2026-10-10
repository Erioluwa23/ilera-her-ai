import type { IlaraLanguage } from "./languages";

export type VoiceMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  createdAt: number;
  language: IlaraLanguage;
  replyTo?: string;
  text?: string;
  audio?: Blob;
  filename?: string;
  confirmed?: boolean;
  error?: string;
  urgency?: string;
  disclaimer?: string;
  sources?: { title: string; url: string }[];
  model?: string;
  generationProvider?: string;
  nextSteps?: string[];
  currentEpisode?: boolean;
};
export type ConversationTurn = { role: "user" | "assistant"; content: string };

// Follow the selected branch only. Unrelated conversations never enter a prompt.
export function contextFor(
  messages: VoiceMessage[],
  parentId?: string,
): ConversationTurn[] {
  const chain: ConversationTurn[] = [];
  const seen = new Set<string>();
  const conversationId = messages.find(
    (m) => m.id === parentId,
  )?.conversationId;
  while (parentId && chain.length < 8 && !seen.has(parentId)) {
    seen.add(parentId);
    const message = messages.find((m) => m.id === parentId);
    if (!message || message.conversationId !== conversationId) break;
    if (message.text && (message.role === "assistant" || message.confirmed)) {
      chain.unshift({
        role: message.role,
        content: message.text.slice(0, 800),
      });
    }
    parentId = message.replyTo;
  }
  return chain;
}

export function parseConversation(value: unknown): ConversationTurn[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8)
    throw new Error("Invalid conversation");
  return value.map((turn) => {
    if (
      !turn ||
      (turn.role !== "user" && turn.role !== "assistant") ||
      typeof turn.content !== "string" ||
      !turn.content.trim() ||
      turn.content.length > 800
    ) {
      throw new Error("Invalid conversation");
    }
    return { role: turn.role, content: turn.content.trim() };
  });
}
