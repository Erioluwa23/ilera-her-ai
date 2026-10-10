"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
export type Flow = "spotting" | "light" | "medium" | "heavy";
export type PeriodLog = {
  id: string;
  startDate: string;
  endDate?: string;
  flow: Flow;
  pain: number;
  notes?: string;
  symptoms?: string[];
  ongoing?: boolean;
  entries?: {
    date: string;
    flow: Flow;
    pain: number;
    symptoms?: string[];
    notes?: string;
  }[];
};
const KEY = "ileraher-periods-v2",
  LEGACY = "ileraher-cycle-v1",
  EVENT = "ileraher-periods-changed";
function snapshot() {
  try {
    return (
      localStorage.getItem(KEY) ??
      "legacy:" + (localStorage.getItem(LEGACY) ?? "[]")
    );
  } catch {
    return "[]";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
function parse(raw: string): PeriodLog[] {
  try {
    const legacy = raw.startsWith("legacy:");
    const data = JSON.parse(legacy ? raw.slice(7) : raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((x, i) =>
        legacy
          ? { ...x, id: "legacy-" + i + "-" + x.date, startDate: x.date }
          : x,
      )
      .filter(
        (x) =>
          typeof x.id === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(x.startDate) &&
          ["spotting", "light", "medium", "heavy"].includes(x.flow) &&
          typeof x.pain === "number",
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  } catch {
    return [];
  }
}
export function usePeriodLogs() {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const logs = useMemo(() => parse(raw), [raw]);
  const [error, setError] = useState("");
  function persist(next: PeriodLog[]) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(
          [...next].sort((a, b) => b.startDate.localeCompare(a.startDate)),
        ),
      );
      window.dispatchEvent(new Event(EVENT));
      setError("");
      return true;
    } catch {
      setError("Could not save changes. Check your browser storage settings.");
      return false;
    }
  }
  function clear() {
    try {
      localStorage.setItem(KEY, "[]");
      localStorage.removeItem(LEGACY);
      window.dispatchEvent(new Event(EVENT));
      setError("");
      return true;
    } catch {
      setError(
        "Could not delete local records. Check your browser storage settings.",
      );
      return false;
    }
  }
  return { logs, error, persist, clear, ready };
}
