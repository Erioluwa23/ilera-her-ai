"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  emptyHealthData,
  validateHealthData,
  type HealthData,
} from "./health/records";
import { notifyStores, scopedKey, subscribe, useOwner } from "./experience";
export function healthKey(owner: string) {
  return scopedKey(owner, "health-v3");
}
export async function commitHealth(
  owner: string,
  change: (current: HealthData) => HealthData,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const commit = () => {
    const key = healthKey(owner),
      raw = storage.getItem(key),
      current = raw ? validateHealthData(JSON.parse(raw)) : emptyHealthData();
    const next = validateHealthData(change(structuredClone(current)));
    next.revision = current.revision + 1;
    storage.setItem(key, JSON.stringify(next));
    if (typeof window !== "undefined") notifyStores();
    return next;
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(healthKey(owner), commit);
  return commit();
}
export function useHealthData() {
  const owner = useOwner(),
    key = owner ? healthKey(owner) : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return key ? (localStorage.getItem(key) ?? "") : "!auth";
      } catch {
        return "!storage";
      }
    },
    () => "!loading",
  );
  const [saveError, setSaveError] = useState("");
  const parsed = useMemo(() => {
    if (raw.startsWith("!"))
      return {
        data: emptyHealthData(),
        error:
          raw === "!storage"
            ? "Saved records could not be opened. Check browser storage and try again."
            : "",
        loaded: false,
      };
    try {
      return {
        data: raw ? validateHealthData(JSON.parse(raw)) : emptyHealthData(),
        error: "",
        loaded: true,
      };
    } catch {
      return {
        data: emptyHealthData(),
        error:
          "Your saved records could not be read. They have been preserved. Restore a valid file or seek storage help.",
        loaded: true,
      };
    }
  }, [raw]);
  async function commit(change: (current: HealthData) => HealthData) {
    try {
      if (!owner) throw new Error("Sign in before saving a personal record.");
      await commitHealth(owner, change);
      setSaveError("");
      return true;
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "This record has not been saved. Try again.",
      );
      return false;
    }
  }
  return {
    ...parsed,
    error: parsed.error || saveError,
    commit,
    retry: notifyStores,
    owner,
  };
}
