import { describe, it, expect } from "vitest";
import {
  dailyEntry,
  loggedOnDate,
  periodForDate,
  validatePeriod,
} from "./period-records";
import type { PeriodLog } from "./period-store";
const log: PeriodLog = {
  id: "existing",
  startDate: "2026-09-01",
  flow: "light",
  pain: 2,
  notes: "Keep original note",
};
describe("period record compatibility and editing", () => {
  it("does not turn a legacy unknown end into an ongoing period", () => {
    expect(periodForDate([log], "2026-09-02")).toBeUndefined();
    expect(
      validatePeriod(
        { ...log, id: "new", startDate: "2026-10-01" },
        [log],
        "2026-10-10",
      ),
    ).toBeNull();
  });
  it("finds an ongoing episode for a new daily log without inventing a recorded day", () => {
    const ongoing = { ...log, ongoing: true };
    expect(periodForDate([ongoing], "2026-09-03")).toBe(ongoing);
    expect(loggedOnDate(ongoing, "2026-09-03")).toBe(false);
  });
  it("preserves distinct symptoms and notes for each day", () => {
    const updated = {
      ...log,
      entries: [
        {
          date: "2026-09-02",
          flow: "heavy" as const,
          pain: 6,
          notes: "Second day",
        },
      ],
    };
    expect(dailyEntry(updated, "2026-09-02").notes).toBe("Second day");
    expect(dailyEntry(updated, "2026-09-01").notes).toBe("Keep original note");
    expect(loggedOnDate(updated, "2026-09-02")).toBe(true);
  });
  it("rejects overlap while allowing edits of the same episode", () => {
    expect(
      validatePeriod(
        { ...log, id: "new", startDate: "2026-09-02" },
        [{ ...log, endDate: "2026-09-05" }],
        "2026-10-10",
      ),
    ).toBe("overlap");
    expect(
      validatePeriod({ ...log, endDate: "2026-09-05" }, [log], "2026-10-10"),
    ).toBeNull();
  });
  it.each([
    { startDate: "2026-02-30" },
    { startDate: "2026-10-11" },
    { endDate: "2026-08-31" },
    { endDate: "2026-10-11" },
    { pain: 11 },
    { pain: 1.5 },
  ])("rejects invalid dates or pain %j", (changes) => {
    expect(validatePeriod({ ...log, ...changes }, [], "2026-10-10")).toBe(
      "validDates",
    );
  });
});
