"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  type CyclePreferences,
} from "./cycle-prediction/types";
import type { CycleState } from "./cycle-prediction/store";
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
  previousCycle?: "unknown" | "complete" | "missing";
  version?: number;
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
  EVENT = "ileraher-account-cycles-changed";
// Browser history is only inspected by the explicit import UI, never automatically uploaded.
export function readLegacyPeriods(): PeriodLog[] {
  try {
    const current = localStorage.getItem(KEY),
      legacy = !current;
    const data = JSON.parse(current || localStorage.getItem(LEGACY) || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .map((x, i) =>
        legacy
          ? { ...x, id: "legacy-" + i + "-" + x.date, startDate: x.date }
          : x,
      )
      .filter(
        (x) =>
          x &&
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
export function deleteLegacyPeriods() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY);
}
function requestHeaders(owner?: string) {
  return {
    "Content-Type": "application/json",
    "x-ileraher-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(owner ? { "x-ileraher-account": owner } : {}),
  };
}
export function usePeriodLogs() {
  const [data, setData] = useState<CycleState | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    sequence = useRef(0),
    mutationBusy = useRef(false);
  const reload = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const response = await fetch("/api/v1/cycles/history", {
        credentials: "same-origin",
        cache: "no-store",
        headers: requestHeaders(),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "cycle_service_unavailable");
      if (active.current && seq === sequence.current) {
        setData(body);
        setError("");
      }
    } catch (e) {
      if (active.current && seq === sequence.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "cycle_service_unavailable");
      }
    } finally {
      if (active.current && seq === sequence.current) setReady(true);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void reload();
    const refresh = () => {
      if (!mutationBusy.current) void reload();
    };
    window.addEventListener(EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active.current = false;
      ++sequence.current;
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  async function mutate(path: string, method: string, body?: unknown) {
    if (!data || mutationBusy.current) return false;
    mutationBusy.current = true;
    setBusy(true);
    setError("");
    ++sequence.current;
    try {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: requestHeaders(data.userId),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const next = await response.json();
      if (!response.ok)
        throw new Error(next.error || "cycle_service_unavailable");
      if (next.userId && next.userId !== data.userId)
        throw new Error("account_changed");
      if (active.current && next.userId) setData(next);
      if (!next.userId) await reload();
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "cycle_service_unavailable";
      if (active.current) {
        setError(code);
        if (code === "account_changed") setData(null);
      }
      return false;
    } finally {
      mutationBusy.current = false;
      if (active.current) setBusy(false);
    }
  }
  function save(log: PeriodLog) {
    const existing = data?.logs.find((x) => x.id === log.id);
    return mutate(
      "/api/v1/periods" + (existing ? "/" + encodeURIComponent(log.id) : ""),
      existing ? "PATCH" : "POST",
      { period: log, version: existing?.version },
    );
  }
  function remove(log: PeriodLog) {
    return mutate("/api/v1/periods/" + encodeURIComponent(log.id), "DELETE", {
      version: log.version,
    });
  }
  function setPreferences(preferences: CyclePreferences) {
    return mutate("/api/v1/cycles/preferences", "PUT", {
      preferences,
      revision: data?.revision,
    });
  }
  function importLegacy(logs: PeriodLog[]) {
    return mutate("/api/v1/periods/import", "POST", { periods: logs });
  }
  function clear() {
    return mutate("/api/v1/cycles/history", "DELETE");
  }
  async function exportRecords() {
    if (!data || mutationBusy.current) return null;
    mutationBusy.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/cycles/export", {
        credentials: "same-origin",
        cache: "no-store",
        headers: requestHeaders(data.userId),
      });
      const body = await response.json();
      if (!response.ok || body.userId !== data.userId)
        throw new Error(body.error || "account_changed");
      return body;
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "cycle_service_unavailable");
      return null;
    } finally {
      mutationBusy.current = false;
      if (active.current) setBusy(false);
    }
  }
  return {
    logs: data?.logs || [],
    preferences: data?.preferences || DEFAULT_PREFERENCES,
    prediction: data?.prediction || null,
    userId: data?.userId || null,
    revision: data?.revision || 0,
    ready,
    error,
    busy,
    reload,
    save,
    remove,
    setPreferences,
    importLegacy,
    clear,
    exportRecords,
  };
}
export type PeriodStore = ReturnType<typeof usePeriodLogs>;
