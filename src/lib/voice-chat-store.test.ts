import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteVoiceConversation,
  loadVoiceMessages,
  saveVoiceMessage,
  legacyVoiceCount,
  recoverLegacyVoice,
} from "./voice-chat-store";
import type { VoiceMessage } from "./voice-chat";
const message: VoiceMessage = {
  id: "user-one",
  conversationId: "thread-one",
  role: "user",
  createdAt: 1,
  language: "yo",
  text: "Fixture",
  audio: new Blob(["fixture"], { type: "audio/wav" }),
};
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
describe("account-scoped IndexedDB preserves original voice relationships", () => {
  it("preserves previously saved audio when later text updates omit recording retention", async () => {
    await saveVoiceMessage("one", message);
    const saved = await saveVoiceMessage("one", {
      ...message,
      audio: undefined,
      text: "Confirmed fixture",
      confirmed: true,
    });
    expect(await saved.audio?.text()).toBe("fixture");
    expect((await loadVoiceMessages("one"))[0].text).toBe("Confirmed fixture");
  });
  it("does not expose another account and deletes only the selected thread", async () => {
    await saveVoiceMessage("one", message);
    await saveVoiceMessage("one", {
      ...message,
      id: "reply",
      role: "assistant",
      replyTo: message.id,
    });
    await saveVoiceMessage("two", message);
    expect(await loadVoiceMessages("one")).toHaveLength(2);
    expect(await loadVoiceMessages("two")).toHaveLength(1);
    await deleteVoiceConversation("one", message.conversationId);
    expect(await loadVoiceMessages("one")).toHaveLength(0);
    expect(await loadVoiceMessages("two")).toHaveLength(1);
  });
  it("leaves unscoped originals intact until deliberate idempotent recovery", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("ileraher-voice-chat-v1", 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("messages", { keyPath: "id" });
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("messages", "readwrite");
        tx.objectStore("messages").put(message);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => reject(req.error);
    });
    expect(await legacyVoiceCount()).toBe(1);
    expect(await loadVoiceMessages("one")).toHaveLength(0);
    await recoverLegacyVoice("one");
    await recoverLegacyVoice("one");
    const saved = await loadVoiceMessages("one");
    expect(saved).toHaveLength(1);
    expect(saved[0].language).toBe("yo");
    expect(await saved[0].audio?.text()).toBe("fixture");
    expect(await legacyVoiceCount()).toBe(1);
  });
});
