import { describe, expect, it } from "vitest";
import {
  emptyHealthData,
  validateHealthData,
  mergeHealthData,
  type PeriodLog,
} from "./records";
import { commitHealth, healthKey } from "../health-store";
import { readLegacy, migrateLegacy } from "../legacy-data";
const period: PeriodLog = {
  id: "first",
  startDate: "2026-01-01",
  flow: null,
  pain: null,
  notes: "legacy note",
  confirmed: true,
};
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) || null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    map,
  };
}
describe("scoped storage, migration and import UX-10/13/14/31/32/52", () => {
  it("keeps missing values distinct and namespaces two accounts", async () => {
    const s = storage();
    await commitHealth("one", (x) => ({ ...x, periods: [period] }), s);
    await commitHealth("two", (x) => x, s);
    expect(JSON.parse(s.getItem(healthKey("one"))!).periods[0]).toMatchObject({
      flow: null,
      pain: null,
    });
    expect(JSON.parse(s.getItem(healthKey("two"))!).periods).toHaveLength(0);
  });
  it("does not claim success when a write fails", async () => {
    const s = storage();
    s.setItem(healthKey("one"), JSON.stringify(emptyHealthData()));
    const original = s.getItem(healthKey("one"));
    await expect(
      commitHealth("one", (x) => ({ ...x, periods: [period] }), {
        getItem: s.getItem,
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).rejects.toThrow("quota");
    expect(s.getItem(healthKey("one"))).toBe(original);
  });
  it("copies legacy records idempotently only after deliberate recovery", async () => {
    const s = storage();
    const raw = JSON.stringify([{ ...period, flow: "light", pain: 0 }]);
    s.setItem("ileraher-periods-v2", raw);
    expect(s.getItem(healthKey("one"))).toBeNull();
    const old = readLegacy(s);
    const first = migrateLegacy(emptyHealthData(), old.records),
      twice = migrateLegacy(first, old.records);
    expect(twice.periods).toHaveLength(1);
    expect(twice.periods[0].notes).toBe("legacy note");
    expect(twice.periods[0].pain).toBe(0);
    expect(s.getItem("ileraher-periods-v2")).toBe(raw);
  });
  it("rejects bad versions, impossible dates, orphan children and changed conversions without mutation", () => {
    const current = emptyHealthData(),
      invalid = {
        ...current,
        periods: [{ ...period, startDate: "2026-02-30" }],
      };
    expect(() => validateHealthData(invalid)).toThrow();
    expect(() => validateHealthData({ ...current, version: 99 })).toThrow();
    expect(() =>
      validateHealthData({
        ...current,
        measurements: [{ id: "m", babyId: "absent" }],
      }),
    ).toThrow();
    expect(current.periods).toEqual([]);
  });
  it("is idempotent for identical imports and refuses conflicting IDs or overlaps", () => {
    const current = { ...emptyHealthData(), periods: [period] };
    expect(mergeHealthData(current, current).periods).toHaveLength(1);
    expect(() =>
      mergeHealthData(current, {
        ...emptyHealthData(),
        periods: [{ ...period, pain: 4 }],
      }),
    ).toThrow("Conflicting");
    expect(() =>
      mergeHealthData(current, {
        ...emptyHealthData(),
        periods: [{ ...period, id: "other" }],
      }),
    ).toThrow("overlap");
    expect(current.periods[0].pain).toBeNull();
  });
});
