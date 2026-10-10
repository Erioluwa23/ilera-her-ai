"use client";
import { useSyncExternalStore } from "react";
import { addDays, todayIn } from "./health/date-only";
export function millisecondsToLagosMidnight(now = new Date()) {
  return Math.max(
    1,
    Date.parse(addDays(todayIn("Africa/Lagos", now), 1) + "T00:00:00+01:00") -
      now.getTime(),
  );
}
function subscribeToday(changed: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    changed();
    timer = setTimeout(schedule, millisecondsToLagosMidnight());
  };
  timer = setTimeout(schedule, millisecondsToLagosMidnight());
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", schedule);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", schedule);
    document.removeEventListener("visibilitychange", schedule);
  };
}
export function useToday() {
  return useSyncExternalStore(
    subscribeToday,
    () => todayIn(),
    () => todayIn(),
  );
}
