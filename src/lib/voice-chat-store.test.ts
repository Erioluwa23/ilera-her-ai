import { beforeEach, describe, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  loadVoiceMessages,
  saveVoiceMessage,
  deleteVoiceMessage,
  deleteVoiceConversation,
} from "./voice-chat-store";
import type { VoiceMessage } from "./voice-chat";
const message = (id: string, conversationId = "thread"): VoiceMessage => ({
  id,
  conversationId,
  role: "user",
  language: "yo",
  createdAt: 1,
  audio: new Blob(["audio-data"], { type: "audio/webm" }),
  draft: true,
});
describe("device conversation storage", () => {
  beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
  it("restores an unsent recording and transcript after reopening storage", async () => {
    await saveVoiceMessage({ ...message("draft"), text: "Edited words" });
    const [restored] = await loadVoiceMessages();
    expect(restored.text).toBe("Edited words");
    expect(restored.draft).toBe(true);
    expect(await restored.audio!.text()).toBe("audio-data");
  });
  it("updates one record without losing another conversation", async () => {
    await saveVoiceMessage(message("a"));
    await saveVoiceMessage(message("b", "other"));
    await saveVoiceMessage({ ...message("a"), confirmed: true, draft: false });
    expect((await loadVoiceMessages()).map((m) => [m.id, m.confirmed])).toEqual(
      [
        ["a", true],
        ["b", undefined],
      ],
    );
  });
  it("deletes only the chosen draft or conversation", async () => {
    await saveVoiceMessage(message("a"));
    await saveVoiceMessage(message("b"));
    await saveVoiceMessage(message("c", "other"));
    await deleteVoiceMessage("a");
    expect((await loadVoiceMessages()).map((m) => m.id)).toEqual(["b", "c"]);
    await deleteVoiceConversation("thread");
    expect((await loadVoiceMessages()).map((m) => m.id)).toEqual(["c"]);
  });
  it("reports a failed save without evicting existing audio", async () => {
    await saveVoiceMessage(message("a"));
    await expect(
      saveVoiceMessage({
        ...message("large"),
        audio: new Blob([new Uint8Array(50 * 1024 * 1024)]),
      }),
    ).rejects.toThrow("not saved");
    expect((await loadVoiceMessages()).map((m) => m.id)).toEqual(["a"]);
  });
});
