"use client";
import { useState, useSyncExternalStore } from "react";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "./languages";
const EVENT = "ileraher-language-changed",
  KEY = "ileraher-language-v1";
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
}
function snapshot(): IlaraLanguage {
  try {
    const value = localStorage.getItem(KEY);
    return LANGUAGE_OPTIONS.some((x) => x.code === value)
      ? (value as IlaraLanguage)
      : "en-NG";
  } catch {
    return "en-NG";
  }
}
export function useLanguage() {
  const [temporary, setTemporary] = useState<IlaraLanguage | null>(null);
  const stored = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "en-NG" as IlaraLanguage,
  );
  function setLanguage(value: IlaraLanguage) {
    try {
      localStorage.setItem(KEY, value);
      setTemporary(null);
    } catch {
      setTemporary(value);
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return { language: temporary ?? stored, setLanguage };
}
