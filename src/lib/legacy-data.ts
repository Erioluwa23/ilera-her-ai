import {
  emptyHealthData,
  mergeHealthData,
  validatePeriod,
  type HealthData,
  type PeriodLog,
} from "./health/records";
export function readLegacy(storage: Pick<Storage, "getItem">): {
  raw: string | null;
  records: PeriodLog[];
} {
  const current = storage.getItem("ileraher-periods-v2"),
    oldest = storage.getItem("ileraher-cycle-v1");
  if (!current && !oldest) return { raw: null, records: [] };
  const data = JSON.parse(current || oldest!);
  if (!Array.isArray(data))
    throw new Error(
      "The old store could not be read. Original data has been preserved.",
    );
  const records = data.map((x, i) => ({
    ...x,
    id: x.id || "legacy-" + i + "-" + x.date,
    startDate: x.startDate || x.date,
    flow: x.flow ?? null,
    pain: x.pain ?? null,
  }));
  if (!records.every((x) => validatePeriod(x)))
    throw new Error(
      "Some old records need correction. Export the original file; nothing has been removed or imported.",
    );
  return {
    raw: JSON.stringify({
      "ileraher-periods-v2": current,
      "ileraher-cycle-v1": oldest,
    }),
    records,
  };
}

export function migrateLegacy(current: HealthData, records: PeriodLog[]) {
  const incoming = emptyHealthData();
  incoming.periods = records;
  return mergeHealthData(current, incoming);
}
