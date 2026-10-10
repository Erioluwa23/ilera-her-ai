"use client";
import { useHealthData } from "./health-store";
import { assertPeriodConflict, type PeriodLog } from "./health/records";
export type { Flow, PeriodLog } from "./health/records";
export function usePeriodLogs() {
  const store = useHealthData();
  return {
    logs: [...store.data.periods].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    ),
    error: store.error,
    loaded: store.loaded,
    persist: (next: PeriodLog[]) =>
      store.commit((current) => ({ ...current, periods: next })),
    upsert: (record: PeriodLog) =>
      store.commit((current) => {
        assertPeriodConflict(current.periods, record);
        return {
          ...current,
          periods: [
            ...current.periods.filter((x) => x.id !== record.id),
            record,
          ],
        };
      }),
    remove: (id: string) =>
      store.commit((current) => ({
        ...current,
        periods: current.periods.filter((x) => x.id !== id),
      })),
    clear: () => store.commit((current) => ({ ...current, periods: [] })),
  };
}
