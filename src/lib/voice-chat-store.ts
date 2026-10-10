import type { VoiceMessage } from "./voice-chat";

const NAME = "ileraher-voice-chat-v1";
const STORE = "messages";
const LIMIT = 50 * 1024 * 1024;
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onerror = () => reject(new Error("Device storage unavailable"));
    request.onblocked = () =>
      reject(new Error("Close other app tabs to open saved messages"));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function loadVoiceMessages(): Promise<VoiceMessage[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      tx.oncomplete = () =>
        resolve(
          (request.result as VoiceMessage[]).sort(
            (a, b) => a.createdAt - b.createdAt,
          ),
        );
      tx.onabort = tx.onerror = () =>
        reject(new Error("Saved messages could not be opened"));
    });
  } finally {
    db.close();
  }
}
export async function saveVoiceMessage(message: VoiceMessage): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const all = store.getAll();
      all.onsuccess = () => {
        const others = (all.result as VoiceMessage[]).filter(
          (m) => m.id !== message.id,
        );
        const bytes = others.reduce(
          (sum, m) => sum + (m.audio?.size || 0),
          message.audio?.size || 0,
        );
        if (bytes > LIMIT || others.length >= 300) {
          tx.abort();
          return;
        }
        store.put(message);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "Message not saved. Download it, then delete older conversations or check device storage.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function deleteVoiceConversation(
  conversationId: string,
): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (row.value.conversationId === conversationId) row.delete();
        row.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("Conversation could not be deleted"));
    });
  } finally {
    db.close();
  }
}
export async function deleteVoiceMessage(id: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("Recording could not be deleted"));
    });
  } finally {
    db.close();
  }
}
