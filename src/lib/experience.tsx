"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useLanguage } from "./use-language";
import { clearVoiceSessions } from "./voice-session";
export type Preferences = {
  version: 1;
  focus: "periods" | "general" | "conception" | "pregnancy" | "baby";
  sharedDevice: boolean;
  hideSensitivePreviews: boolean;
  lowData: boolean;
  conversationRetention: "session" | "device";
  keepAudio: boolean;
  externalAI: boolean;
  voiceNoticeAccepted: boolean;
  onboardingVersionCompleted: number;
};
export const defaultPreferences: Preferences = {
  version: 1,
  focus: "periods",
  sharedDevice: false,
  hideSensitivePreviews: false,
  lowData: false,
  conversationRetention: "session",
  keepAudio: false,
  externalAI: false,
  voiceNoticeAccepted: false,
  onboardingVersionCompleted: 0,
};
const Context = createContext<{ owner: string | null }>({ owner: null });
export const CHANGE = "ileraher-data-changed";
export function notifyStores() {
  window.dispatchEvent(new Event(CHANGE));
}
export function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(CHANGE, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(CHANGE, fn);
  };
}
export function ExperienceProvider({
  owner,
  expiresAt,
  children,
}: {
  owner: string | null;
  expiresAt?: number;
  children: React.ReactNode;
}) {
  const { language } = useLanguage();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const clear = () => clearVoiceSessions();
    window.addEventListener("ileraher-session-ended", clear);
    return () => window.removeEventListener("ileraher-session-ended", clear);
  }, []);
  useEffect(() => {
    if (!owner || !expiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = expiresAt * 1000 - Date.now();
      if (remaining > 0) {
        timer = setTimeout(check, Math.min(remaining, 2147483647));
        return;
      }
      window.dispatchEvent(new Event("ileraher-session-ended"));
      window.speechSynthesis?.cancel();
      setExpired(true);
    };
    timer = setTimeout(
      check,
      Math.max(0, Math.min(expiresAt * 1000 - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [owner, expiresAt]);
  return (
    <Context.Provider value={{ owner: expired ? null : owner }}>
      {expired ? (
        <main className="authPage">
          <section className="authCard">
            <h1>Please sign in again</h1>
            <p>
              Your saved records remain on this device. Reconnect to verify your
              session.
            </p>
            <a className="btn" href="/login">
              Sign in
            </a>
            <a className="secondaryBtn" href="/help">
              Open Help
            </a>
          </section>
        </main>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
export function useOwner() {
  return useContext(Context).owner;
}
export function scopedKey(owner: string, kind: string) {
  return "ileraher:account:" + encodeURIComponent(owner) + ":" + kind;
}
export function usePreferences() {
  const owner = useOwner(),
    key = owner ? scopedKey(owner, "preferences-v1") : null;
  const [error, setError] = useState("");
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return key ? localStorage.getItem(key) || "" : "";
      } catch {
        return "!error";
      }
    },
    () => "",
  );
  const prefs = useMemo(() => {
    try {
      const x = JSON.parse(raw);
      return x?.version === 1
        ? ({ ...defaultPreferences, ...x } as Preferences)
        : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  }, [raw]);
  function update(changes: Partial<Preferences>) {
    try {
      if (!key) throw new Error();
      localStorage.setItem(
        key,
        JSON.stringify({ ...prefs, ...changes, version: 1 }),
      );
      notifyStores();
      setError("");
      return true;
    } catch {
      setError(
        "Preferences have not been saved. Check your browser storage settings.",
      );
      return false;
    }
  }
  return {
    prefs,
    update,
    error:
      error || (raw === "!error" ? "Preferences could not be opened." : ""),
  };
}
