import type { VoiceMessage } from "./voice-chat";
const NAME = "ileraher-voice-chat-v1",
  LEGACY = "messages",
  STORE = "scopedMessages",
  LIMIT = 50 * 1024 * 1024;
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LEGACY))
        request.result.createObjectStore(LEGACY, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "storageId" });
    };
    request.onerror = () => reject(new Error("Device storage unavailable"));
    request.onblocked = () =>
      reject(new Error("Close other app tabs to open saved messages"));
    request.onsuccess = () => resolve(request.result);
  });
}
type ScopedMessage = VoiceMessage & { ownerScope: string; storageId: string };
export async function loadVoiceMessages(
  owner: string,
): Promise<VoiceMessage[]> {
  if (!owner) throw new Error("Sign in to open personal conversations.");
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly"),
        req = tx.objectStore(STORE).getAll();
      tx.oncomplete = () =>
        resolve(
          (req.result as ScopedMessage[])
            .filter((m) => m.ownerScope === owner)
            .map((row) => {
              const message = { ...row } as Partial<ScopedMessage>;
              delete message.ownerScope;
              delete message.storageId;
              return message as VoiceMessage;
            })
            .sort((a, b) => a.createdAt - b.createdAt),
        );
      tx.onabort = tx.onerror = () =>
        reject(new Error("Saved conversations could not be opened"));
    });
  } finally {
    db.close();
  }
}
export async function saveVoiceMessage(
  owner: string,
  message: VoiceMessage,
): Promise<VoiceMessage> {
  if (!owner) throw new Error("Sign in before saving conversations.");
  const db = await open();
  try {
    return await new Promise<VoiceMessage>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"),
        store = tx.objectStore(STORE),
        all = store.getAll();
      let retained = message;
      all.onsuccess = () => {
        const previous = (all.result as ScopedMessage[]).find(
          (m) => m.ownerScope === owner && m.id === message.id,
        );
        // Turning off future recording retention does not erase earlier saved audio.
        retained = {
          ...message,
          audio: message.audio ?? previous?.audio,
          filename: message.filename ?? previous?.filename,
        };
        const others = (all.result as ScopedMessage[]).filter(
            (m) => m.ownerScope === owner && m.id !== message.id,
          ),
          bytes = others.reduce(
            (n, m) => n + (m.audio?.size || 0),
            retained.audio?.size || 0,
          );
        if (bytes > LIMIT || others.length >= 300) {
          tx.abort();
          return;
        }
        store.put({
          ...retained,
          ownerScope: owner,
          storageId: owner + ":" + message.id,
        });
      };
      tx.oncomplete = () => {
        window.dispatchEvent(new Event("ileraher-voice-changed"));
        resolve(retained);
      };
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
  owner: string,
  conversationId: string,
): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"),
        cursor = tx.objectStore(STORE).openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (
          row.value.ownerScope === owner &&
          row.value.conversationId === conversationId
        )
          row.delete();
        row.continue();
      };
      tx.oncomplete = () => {
        window.dispatchEvent(new Event("ileraher-voice-changed"));
        resolve();
      };
      tx.onabort = tx.onerror = () =>
        reject(new Error("Conversation could not be deleted"));
    });
  } finally {
    db.close();
  }
}
export async function legacyVoiceCount(): Promise<number> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction(LEGACY, "readonly")
        .objectStore(LEGACY)
        .count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(new Error("Old conversations could not be opened"));
    });
  } finally {
    db.close();
  }
}
export async function recoverLegacyVoice(owner: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([LEGACY, STORE], "readwrite"),
        req = tx.objectStore(LEGACY).getAll();
      req.onsuccess = () => {
        for (const m of req.result as VoiceMessage[]) {
          const target = tx.objectStore(STORE),
            key = owner + ":" + m.id,
            existing = target.get(key);
          existing.onsuccess = () => {
            if (!existing.result)
              target.put({ ...m, ownerScope: owner, storageId: key });
          };
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "Recovery did not complete. Old conversations are preserved.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function deleteVoiceMessage(
  owner: string,
  id: string,
): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(owner + ":" + id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("The recording could not be discarded."));
    });
  } finally {
    db.close();
  }
}
