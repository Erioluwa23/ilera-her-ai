import { describe, expect, it } from "vitest";
import {
  addDays,
  addCalendarMonths,
  daysBetween,
  completedMonths,
  validDate,
  todayIn,
} from "./date-only";
import {
  cycleForecast,
  fertilityEstimate,
  periodDuration,
  currentCycleDay,
} from "./cycle-calculations";
import { pregnancyDates } from "./pregnancy-calculations";
import {
  babyAge,
  weightKg,
  lengthCm,
  temperatureC,
  correctedAge,
  weightChange,
  birthWeightChange,
} from "./baby-calculations";
import { latePeriodFacts, conceptionFacts } from "./timing-calculations";
import { lmsScore, interpolateLMS, roundWHO } from "./growth-reference";
import { publishable, POLICIES } from "./policies";
import { latePeriodCare, infantTemperatureCandidate } from "./care-rules";
const dates = ["2026-07-15", "2026-08-12", "2026-09-10", "2026-10-10"];
const records = (starts: string[]) =>
  starts.map((startDate, i) => ({ id: String(i), startDate, confirmed: true }));
const context = {
  regular: true,
  pregnancy: false,
  postpartum: false,
  hormonal: false,
};
describe("date-only contracts D1–D3", () => {
  it("rejects rollover, future unsupported years and fractional increments", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("0099-01-01")).toBe(false);
    expect(() => addDays("2026-01-01", 0.5)).toThrow();
  });
  it("handles leap and clamped calendar anniversaries", () => {
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(completedMonths("2026-01-31", "2026-02-28")).toBe(1);
  });
  it("uses local today without changing event arithmetic across DST", () => {
    const now = new Date("2026-10-09T23:30:00Z");
    expect(todayIn("Africa/Lagos", now)).toBe("2026-10-10");
    expect(todayIn("America/New_York", now)).toBe("2026-10-09");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
});
describe("period P1–P5", () => {
  it("counts duration inclusively and rejects negative/future cycle days", () => {
    expect(periodDuration("2026-10-10", "2026-10-14")).toBe(5);
    expect(periodDuration("2026-10-10")).toBeNull();
    expect(currentCycleDay("2026-10-10", "2026-10-17")).toBe(8);
    expect(() => currentCycleDay("2026-10-11", "2026-10-10")).toThrow();
  });
  it("returns the independently specified median and range", () => {
    const r = cycleForecast(records(dates), "2026-10-17");
    expect(r).toMatchObject({
      median: 29,
      sampleCount: 3,
      estimatedNextStart: "2026-11-08",
      observedRangeStart: "2026-11-07",
      observedRangeEnd: "2026-11-09",
      MAD: 1,
    });
  });
  it("needs four starts and blocks duplicate/gap records without erasing them", () => {
    expect(
      cycleForecast(records(dates.slice(1)), "2026-10-10").estimatedNextStart,
    ).toBeNull();
    expect(
      cycleForecast(records([...dates, dates[3]]), "2026-10-10").reasons,
    ).toContain("duplicate_starts");
    const x = records(dates);
    expect(
      cycleForecast(
        [...x.slice(0, -1), { ...x[3], gapBefore: true }],
        "2026-10-10",
      ).estimatedNextStart,
    ).toBeNull();
    expect(x).toHaveLength(4);
  });
  it("retains and blocks a 70-day interval rather than filtering it", () => {
    const r = cycleForecast(
      records([
        "2026-04-01",
        "2026-05-01",
        "2026-07-10",
        "2026-08-09",
        "2026-09-08",
        "2026-10-08",
      ]),
      "2026-10-10",
    );
    expect(r.intervals.map((x) => x.days)).toContain(70);
    expect(r.reasons).toContain("interval_outside_policy");
    expect(r.estimatedNextStart).toBeNull();
  });
});
describe("fertility F1–F4", () => {
  const history = records(
    Array.from({ length: 7 }, (_, i) => addDays("2026-10-10", (i - 6) * 28)),
  );
  it.each([
    [7, "outside"],
    [8, "within"],
    [19, "within"],
    [20, "outside"],
  ])("handles day %s without safe-day claims", (day, state) => {
    const r = fertilityEstimate(
      history,
      addDays("2026-10-10", Number(day) - 1),
      context,
    );
    expect(r.start).toBe("2026-10-17");
    expect(r.end).toBe("2026-10-28");
    expect(r.status).toContain(state);
  });
  it("blocks unknown eligibility, out-of-method history and day 33", () => {
    expect(
      fertilityEstimate(history, "2026-10-10", { ...context, regular: null })
        .start,
    ).toBeNull();
    const irregular = history.map((x, i) =>
      i === 0 ? { ...x, startDate: addDays(x.startDate, 3) } : x,
    );
    expect(
      fertilityEstimate(irregular, "2026-10-10", context).start,
    ).toBeNull();
    expect(fertilityEstimate(history, "2026-11-11", context).reasons).toContain(
      "current_cycle_passed_day_32",
    );
  });
});
describe("pregnancy G1–G8", () => {
  const input = {
    lmp: "2026-01-01",
    reliable: true,
    regular: true,
    usualLength: 28,
  };
  it("reproduces due-date, leap-year and gestational arithmetic", () => {
    expect(pregnancyDates(input, "2026-03-26")).toMatchObject({
      edd: "2026-10-08",
      weeks: 12,
      extraDays: 0,
    });
    expect(
      pregnancyDates({ ...input, lmp: "2024-01-01" }, "2024-03-01").edd,
    ).toBe("2024-10-07");
    expect(
      pregnancyDates({ clinicianEDD: "2026-12-20" }, "2026-10-10"),
    ).toMatchObject({ weeks: 29, extraDays: 6, daysUntilEDD: 71 });
  });
  it("requires explicit adjustment, retains provider provenance and pauses summaries", () => {
    expect(
      pregnancyDates({ ...input, usualLength: 30 }, "2026-10-01").edd,
    ).toBeNull();
    expect(
      pregnancyDates({ ...input, usualLength: 30 }, "2026-10-01", true).edd,
    ).toBe("2026-10-10");
    expect(
      pregnancyDates(
        { ...input, clinicianEDD: "2026-12-20", lmp: "2026-02-01" },
        "2026-10-10",
      ).source,
    ).toBe("provider");
    expect(
      pregnancyDates({ ...input, status: "paused" }, "2026-10-10").status,
    ).toBe("inactive");
  });
  it.each([
    [97, 1],
    [98, 2],
    [195, 2],
    [196, 3],
  ])("selects trimester for %s completed days", (days, trimester) =>
    expect(pregnancyDates(input, addDays(input.lmp, days)).trimester).toBe(
      trimester,
    ),
  );
});
describe("timing L1–L3 and C1–C2", () => {
  it("keeps median and observed delay separate and checks the sex-event threshold", () => {
    expect(
      latePeriodFacts("2026-11-08", "2026-11-09", "2026-11-10"),
    ).toMatchObject({ beyondMedian: 2, beyondObservedRange: 1 });
    expect(
      latePeriodFacts(null, null, "2026-10-09", "2026-09-19"),
    ).toMatchObject({
      testDate: "2026-10-10",
      eligibleBySexDate: false,
      beyondMedian: null,
    });
    expect(
      latePeriodFacts(null, null, "2026-10-10", "2026-09-19").eligibleBySexDate,
    ).toBe(true);
  });
  it("uses completed calendar months and keeps empty checklist unknown", () => {
    expect(
      conceptionFacts("2026-04-10", undefined, "2026-10-09", 0, 0).months,
    ).toBe(5);
    expect(
      conceptionFacts("2026-04-10", "1990-01-01", "2026-10-10", 1, 2),
    ).toMatchObject({
      months: 6,
      candidateMilestone: "2026-10-10",
      checklistProgress: 0.5,
    });
    expect(
      conceptionFacts(undefined, undefined, "2026-10-10", 0, 0)
        .checklistProgress,
    ).toBeNull();
  });
  it("never downgrades danger for a negative test and preserves unknowns", () => {
    const i = {
      fainting: "yes",
      severePain: "no",
      pregnancyPossible: "unsure",
      oneSidedPain: "no",
      unusualBleeding: "no",
      shoulderPain: "no",
      missedThree: "no",
    } as const;
    expect(latePeriodCare(i).action).toBe("emergency");
    expect(latePeriodCare({ ...i, fainting: "unsure" }).action).toBe(
      "needs_clarification",
    );
  });
});
describe("baby B1–B6 and candidate temperature", () => {
  it("does not add an extra birth day and normalizes explicit units", () => {
    expect(babyAge("2026-10-01", "2026-10-10").days).toBe(9);
    expect(weightKg(3500, "g")).toBe(3.5);
    expect(lengthCm(20, "in")).toBe(50.8);
    expect(temperatureC(100.4, "F")).toBeCloseTo(38, 10);
  });
  it("calculates descriptive change and declines same-date rates", () => {
    expect(
      weightChange(
        { date: "2026-10-01", kg: 3.5 },
        { date: "2026-10-11", kg: 3.8 },
      )?.gramsPerDay,
    ).toBeCloseTo(30);
    expect(birthWeightChange(3.5, 3.15).loss).toBeCloseTo(10);
    expect(
      weightChange(
        { date: "2026-10-01", kg: 3.5 },
        { date: "2026-10-01", kg: 3.8 },
      ),
    ).toBeNull();
  });
  it("keeps corrected age negative and rejects invalid values", () => {
    expect(weightKg(0, "lb_oz", 8)).toBeCloseTo(0.226796185);
    expect(correctedAge(70, 34, 0)).toBe(28);
    expect(correctedAge(20, 34, 0)).toBe(-22);
    expect(() => weightKg(Infinity, "kg")).toThrow();
    expect(() => correctedAge(20, 34, 7)).toThrow();
  });
  it("uses a calendar-month fever boundary without inferring birth date", () => {
    expect(
      infantTemperatureCandidate("2026-08-01", "2026-10-10", 100.4, "F", "no")
        .action,
    ).toBe("prompt_assessment");
    expect(
      infantTemperatureCandidate(null, "2026-10-10", 38, "C", "no").action,
    ).toBe("needs_clarification");
  });
});
describe("synthetic growth arithmetic W5–W7, separate from WHO oracle", () => {
  const c = { L: -1, M: 10, S: 0.1 };
  it("accepts negative and zero L and applies indicator-specific tails", () => {
    expect(lmsScore(10, c, "WAZ").zReference).toBe(0);
    expect(lmsScore(15, c, "WAZ").zReference).toBe(3.4);
    expect(lmsScore(15, c, "LAZ").zReference).toBe(3.33);
    expect(lmsScore(10, { ...c, L: 0 }, "WAZ").zReference).toBe(0);
  });
  it("rounds ties to even and flags only strict rounded boundaries", () => {
    expect(roundWHO(1.225)).toBe(1.22);
    expect(roundWHO(1.235)).toBe(1.24);
    expect(roundWHO(-1.225)).toBe(-1.22);
  });
  it("interpolates without requiring an upper endpoint row", () => {
    const rows = new Map([
      [450, c],
      [451, { ...c, M: 12 }],
      [1100, c],
    ]);
    expect(interpolateLMS(45.05, rows)?.M).toBeCloseTo(11);
    expect(interpolateLMS(110, rows)).toEqual(c);
    expect(interpolateLMS(44.9, rows)).toBeNull();
  });
  it("cannot publish a draft even if a reviewer name is inserted", () => {
    expect(
      publishable({ ...POLICIES.growth, reviewer: "example" }, "2026-10-10"),
    ).toBe(false);
  });
});
