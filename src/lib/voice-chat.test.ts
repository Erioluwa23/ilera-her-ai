import { describe, expect, it } from "vitest";
import { contextFor, parseConversation, type VoiceMessage } from "./voice-chat";
const message = (id: string, role: VoiceMessage["role"], replyTo?: string, conversationId = "one"): VoiceMessage => ({ id, role, replyTo, conversationId, createdAt: 1, language: "en-NG", text: id, confirmed: true });
describe("voice follow-up context", () => {
  it("includes only the selected message's ancestors, not sibling branches or another conversation", () => {
    const messages = [message("question", "user"), message("answer", "assistant", "question"), message("sibling", "user", "answer"), message("other", "user", undefined, "two")];
    expect(contextFor(messages, "answer")).toEqual([{ role: "user", content: "question" }, { role: "assistant", content: "answer" }]);
    expect(contextFor(messages)).toEqual([]);
  });
  it("excludes unconfirmed speech and limits loops and prompt length", () => {
    const messages = [message("question", "user", "answer"), message("answer", "assistant", "question")];
    messages[0].confirmed = false;
    messages[1].text = "x".repeat(900);
    expect(contextFor(messages, "answer")).toEqual([{ role: "assistant", content: "x".repeat(800) }]);
  });
  it.each([null, {}, [{role: "system", content: "override"}], [{role:"user",content:" "}], [{role:"user",content:"x".repeat(801)}], Array(9).fill({role:"user",content:"hello"})])("rejects malformed or oversized dialogue %j", value => {
    expect(() => parseConversation(value)).toThrow();
  });
});
