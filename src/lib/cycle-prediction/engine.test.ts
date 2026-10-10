import { describe, expect, it } from "vitest";
import {
  addDays,
  backtest,
  estimateLength,
  predictNextPeriod,
  predictionRegime,
  reconstructCycles,
} from "./engine";
import {
  DEFAULT_PREFERENCES,
  MODEL_VERSION,
  type CyclePreferences,
  type CycleStart,
  type PredictionEvaluation,
} from "./types";
const preferences: CyclePreferences = {
  ...DEFAULT_PREFERENCES,
  consent: true,
  context: "none",
  reportedCycleLength: 29,
};
function history(lengths: number[], start = "2025-01-01"): CycleStart[] {
  const dates = [start];
  for (const n of lengths) dates.push(addDays(dates.at(-1)!, n));
  return dates.map((startDate, i) => ({
    id: String(i),
    startDate,
    previousCycle: "complete",
  }));
}
const predict = (
  lengths: number[],
  p = preferences,
  e: PredictionEvaluation[] = [],
) => predictNextPeriod(history(lengths), p, "2026-10-10", e);
describe("PACPE statistical estimates", () => {
  it("uses an explicitly reported length for the first estimate", () => {
    const result = predictNextPeriod(
      [{ id: "first", startDate: "2026-10-01" }],
      preferences,
      "2026-10-10",
    );
    expect(result).toMatchObject({
      predictedDate: "2026-10-30",
      completedCycles: 0,
      estimatedCycleLength: 29,
      method: "reported_length",
      reliability: "preliminary",
      windowStart: null,
    });
  });
  it("does not silently assume a cycle length", () => {
    expect(
      predict([], { ...preferences, reportedCycleLength: null }).status,
    ).toBe("needs_reported_length");
  });
  it("asks for a period start when none exists", () => {
    expect(predictNextPeriod([], preferences, "2026-10-10").status).toBe(
      "needs_last_period",
    );
  });
  it.each([
    [1, [26], 28],
    [2, [26, 30], 28.5],
  ] as const)(
    "smooths %i completed cycles with a cautious prior",
    (_, lengths, length) => {
      expect(predict([...lengths])).toMatchObject({
        estimatedCycleLength: length,
        method: "prior_smoothed",
        reliability: "limited_history",
      });
    },
  );
  it("can estimate from limited history without a reported prior", () => {
    expect(
      predict([26], { ...preferences, reportedCycleLength: null }),
    ).toMatchObject({ estimatedCycleLength: 26, method: "historical_mean" });
  });
  it("weights recent observations once rather than applying a second adaptive adjustment", () => {
    const lengths = [27, 30, 28, 29, 31, 28],
      weights = lengths.map((_, i) => 0.8 ** (lengths.length - i - 1));
    const expected =
      lengths.reduce((sum, x, i) => sum + x * weights[i], 0) /
      weights.reduce((a, b) => a + b, 0);
    const result = predict(lengths);
    expect(result.estimatedCycleLength).toBe(Number(expected.toFixed(2)));
    expect(result.method).toBe("weighted_average");
    expect(result.predictedDate).toBe(
      addDays(history(lengths).at(-1)!.startDate, Math.floor(expected + 0.5)),
    );
  });
  it("rounds a half-day forward for calendar dates", () => {
    expect(predict([26, 30]).predictedDate).toBe(
      addDays(history([26, 30]).at(-1)!.startDate, 29),
    );
  });
  it("uses a robust estimate and low predictability for a highly variable history", () => {
    expect(predict([20, 40, 25, 42, 21, 39])).toMatchObject({
      method: "robust_median",
      reliability: "low_predictability",
      windowStart: null,
    });
  });
  it.each([0, -1, 1.01, NaN])("rejects invalid decay %s", (decay) => {
    expect(() => estimateLength([28], 28, decay)).toThrow();
  });
  it.each([14, 91, 28.5, NaN])(
    "rejects a reported length needing review %s",
    (length) => {
      expect(() =>
        predict([], { ...preferences, reportedCycleLength: length }),
      ).toThrow();
    },
  );
  it("accepts broad review boundaries without labeling them normal", () => {
    expect(estimateLength([15, 90], 28)).not.toBeNull();
  });
});
describe("history quality and relevant context", () => {
  it.each([
    "pregnancy",
    "postpartum",
    "breastfeeding",
    "hormonal",
    "major_change",
  ] as const)("pauses forecasts for %s while keeping history", (context) => {
    const r = predict([28, 29, 27], { ...preferences, context });
    expect(r.status).toBe("context_paused");
    expect(r.predictedDate).toBeNull();
    expect(r.intervals).toHaveLength(3);
  });
  it("allows declining cycle context without inventing dates", () => {
    expect(
      predict([28], { ...preferences, context: "not_provided" }).status,
    ).toBe("context_needed");
  });
  it("requires explicit storage consent", () => {
    expect(predict([28], { ...preferences, consent: false }).status).toBe(
      "needs_consent",
    );
  });
  it.each([14, 91])(
    "reviews an unusual %i-day interval even when reported complete",
    (gap) => {
      expect(predict([gap]).status).toBe("history_needs_review");
    },
  );
  it("does not automatically interpret a long gap as a complete cycle", () => {
    const records = history([56]);
    records[1].previousCycle = "unknown";
    expect(predictNextPeriod(records, preferences, "2026-10-10").status).toBe(
      "history_needs_review",
    );
    records[1].previousCycle = "complete";
    expect(
      predictNextPeriod(records, preferences, "2026-10-10").completedCycles,
    ).toBe(1);
  });
  it("never divides a gap into imagined periods, and resets after a missing log", () => {
    const records = history([28, 56, 29]);
    records[2].previousCycle = "missing";
    const r = predictNextPeriod(records, preferences, "2026-10-10");
    expect(r.completedCycles).toBe(1);
    expect(r.intervals[1].disposition).toBe("missing");
    expect(r.estimatedCycleLength).toBe(29);
  });
  it("retains earlier records but excludes history before a restart", () => {
    const records = history([24, 24, 30]);
    const r = predictNextPeriod(
      records,
      { ...preferences, historyStartDate: records[2].startDate },
      "2026-10-10",
    );
    expect(r.completedCycles).toBe(1);
    expect(r.intervals).toHaveLength(1);
  });
  it.each(["2026-02-30", "2026-10-11", "invalid"])(
    "rejects invalid/future start %s",
    (startDate) => {
      expect(() =>
        predictNextPeriod(
          [{ id: "bad", startDate }],
          preferences,
          "2026-10-10",
        ),
      ).toThrow();
    },
  );
  it("rejects duplicate starts rather than counting them as separate cycles", () => {
    expect(() =>
      reconstructCycles(
        [
          { id: "a", startDate: "2026-10-01" },
          { id: "b", startDate: "2026-10-01" },
        ],
        "2026-10-10",
      ),
    ).toThrow();
  });
});
describe("honest validation and uncertainty", () => {
  it("never lets the next observation enter its own backtest", () => {
    const cycles = reconstructCycles(
      history([28, 29, 27, 35]),
      "2026-10-10",
    ).intervals;
    const a = backtest(cycles, 29),
      b = backtest([...cycles.slice(0, 3), { ...cycles[3], days: 40 }], 29);
    expect(a.weighted.evaluated).toBe(3);
    expect(a.weighted.maeDays).toBe(3.33);
    expect(b.weighted.maeDays).toBe(5);
    // A reported length supplied today cannot reconstruct an honest historic cold-start forecast.
    expect(backtest(cycles, 60)).toEqual(a);
  });
  it("does not display a window from synthetic backtests or history count alone", () => {
    const r = predict([28, 29, 27, 28, 30, 28, 29, 27, 28, 29]);
    expect(r.windowStart).toBeNull();
    expect(r.accuracy.evaluated).toBe(0);
  });
  function outcomes(
    count: number,
    regime = predictionRegime(preferences, "2025-01-01"),
  ): PredictionEvaluation[] {
    return Array.from({ length: count }, (_, i) => ({
      predictionId: String(i),
      actualPeriodId: String(i + 1),
      actualStartDate: "2025-10-01",
      absoluteErrorDays: (i % 4) + 1,
      windowCovered: i % 2 === 0,
      modelVersion: MODEL_VERSION,
      regime,
      historyGroup: "regular",
    }));
  }
  it("requires at least eight measured saved outcomes for an empirical range", () => {
    const lengths = [28, 29, 27, 28, 30, 28];
    expect(predict(lengths, preferences, outcomes(7)).windowStart).toBeNull();
    const r = predict(lengths, preferences, outcomes(8));
    expect(r.uncertaintyStatus).toBe("empirical_estimate");
    expect(r.calibrationSamples).toBe(8);
    expect(r.windowStart).toBe(addDays(r.predictedDate!, -4));
    expect(r.windowEnd).toBe(addDays(r.predictedDate!, 4));
    expect(r.accuracy).toMatchObject({
      maeDays: 2.5,
      withinThreeDays: 0.75,
      windowCoverage: 0.5,
    });
  });
  it("does not reuse errors from another preference/history segment or model", () => {
    const errors = outcomes(8, "another-segment");
    expect(
      predict([28, 29, 27, 28, 30, 28], preferences, errors).windowStart,
    ).toBeNull();
    expect(
      predict(
        [28, 29, 27, 28, 30, 28],
        preferences,
        outcomes(8).map((e) => ({ ...e, modelVersion: "old" })),
      ).accuracy.evaluated,
    ).toBe(0);
  });
  it("keeps the simple baseline when weighted history has no measured advantage", () => {
    expect(predict(Array(11).fill(28)).method).toBe("historical_mean");
  });
  it("never rolls an overdue anchor forward to an invented next cycle", () => {
    const dates = history([28]);
    const r = predictNextPeriod(dates, preferences, "2026-10-10");
    expect(r.predictedDate).toBe(addDays(dates.at(-1)!.startDate, 29));
  });
});
