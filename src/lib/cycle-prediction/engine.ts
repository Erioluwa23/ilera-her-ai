import { validDate } from "../calendar";
import {
  MODEL_VERSION,
  type Accuracy,
  type CycleInterval,
  type CyclePreferences,
  type CycleStart,
  type ForecastMethod,
  type Prediction,
  type PredictionEvaluation,
} from "./types";

const DAY = 86_400_000;
// Engineering review thresholds, not medical definitions or validated clinical parameters.
export const CONFIG = {
  decay: 0.8,
  priorStrength: 2,
  minGap: 15,
  maxGap: 90,
  reviewGap: 45,
  variableSD: 7,
  variableRange: 20,
  minCalibration: 8,
  minComparison: 8,
};
export function daysBetween(a: string, b: string) {
  return (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY;
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function accuracy(
  errors: number[],
  covered: (boolean | null)[] = [],
): Accuracy {
  const windows = covered.filter((x): x is boolean => x !== null);
  return {
    evaluated: errors.length,
    maeDays: errors.length
      ? Number((errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(2))
      : null,
    withinThreeDays: errors.length
      ? errors.filter((x) => x <= 3).length / errors.length
      : null,
    windowEvaluated: windows.length,
    windowCoverage: windows.length
      ? windows.filter(Boolean).length / windows.length
      : null,
  };
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function estimateLength(
  lengths: number[],
  reported: number | null,
  decay = CONFIG.decay,
  strategy: "weighted" | "baseline" | "robust" = "weighted",
): {
  length: number;
  sd: number;
  method: ForecastMethod;
  variable: boolean;
} | null {
  if (!(decay > 0 && decay <= 1) || !Number.isFinite(decay))
    throw new RangeError("Invalid decay");
  if (
    reported !== null &&
    (!Number.isInteger(reported) || reported < 15 || reported > 90)
  )
    throw new RangeError("Review reported cycle length");
  if (lengths.some((x) => !Number.isInteger(x) || x < 15 || x > 90))
    throw new RangeError("Review cycle history");
  if (!lengths.length)
    return reported === null
      ? null
      : { length: reported, sd: 0, method: "reported_length", variable: false };
  const weights = lengths.map((_, i) => decay ** (lengths.length - i - 1));
  const total = weights.reduce((a, b) => a + b, 0),
    mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const weighted =
    lengths.reduce((sum, x, i) => sum + x * weights[i], 0) / total;
  const sd = Math.sqrt(
    lengths.reduce((sum, x, i) => sum + weights[i] * (x - weighted) ** 2, 0) /
      total,
  );
  const variable =
    lengths.length >= 3 &&
    (sd >= CONFIG.variableSD ||
      Math.max(...lengths) - Math.min(...lengths) >= CONFIG.variableRange);
  if (lengths.length < 3 && reported !== null)
    return {
      length:
        (lengths.reduce((a, b) => a + b, 0) + CONFIG.priorStrength * reported) /
        (lengths.length + CONFIG.priorStrength),
      sd,
      method: "prior_smoothed",
      variable,
    };
  if (strategy === "robust" && variable)
    return { length: median(lengths), sd, method: "robust_median", variable };
  if (lengths.length < 3 || strategy === "baseline")
    return { length: mean, sd, method: "historical_mean", variable };
  return { length: weighted, sd, method: "weighted_average", variable };
}
export function reconstructCycles(
  records: CycleStart[],
  today: string,
  historyStartDate: string | null = null,
) {
  if (
    !validDate(today) ||
    (historyStartDate &&
      (!validDate(historyStartDate) || historyStartDate > today))
  )
    throw new RangeError("Invalid reference date");
  const dates = [...records].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  if (
    dates.some((x) => !validDate(x.startDate) || x.startDate > today) ||
    new Set(dates.map((x) => x.startDate)).size !== dates.length
  )
    throw new RangeError("Review period dates");
  const relevant = dates.filter(
    (x) => !historyStartDate || x.startDate >= historyStartDate,
  );
  const intervals: CycleInterval[] = relevant.slice(1).map((b, i) => {
    const a = relevant[i],
      days = daysBetween(a.startDate, b.startDate);
    const base = {
      fromId: a.id,
      toId: b.id,
      startDate: a.startDate,
      endDate: b.startDate,
      days,
    };
    if (b.previousCycle === "missing")
      return { ...base, disposition: "missing" };
    if (days < CONFIG.minGap)
      return { ...base, disposition: "review", reason: "short_gap" };
    if (days > CONFIG.maxGap)
      return { ...base, disposition: "review", reason: "long_gap" };
    if (days > CONFIG.reviewGap && b.previousCycle !== "complete")
      return { ...base, disposition: "review", reason: "unconfirmed_gap" };
    return { ...base, disposition: "usable" };
  });
  // A missing log breaks continuity. Old patterns are not bridged over that gap.
  const lastBreak = intervals.map((x) => x.disposition).lastIndexOf("missing");
  return {
    dates: relevant,
    intervals,
    segment: intervals.slice(lastBreak + 1),
  };
}
// Walk-forward evaluation. A target cycle never participates in its own estimate.
export function backtest(
  intervals: CycleInterval[],
  reported: number | null,
  decay = CONFIG.decay,
) {
  const errors = {
    weighted: [] as number[],
    baseline: [] as number[],
    robust: [] as number[],
  };
  const groups = {
    coldStart: {
      weighted: [] as number[],
      baseline: [] as number[],
      robust: [] as number[],
    },
    regular: {
      weighted: [] as number[],
      baseline: [] as number[],
      robust: [] as number[],
    },
    variable: {
      weighted: [] as number[],
      baseline: [] as number[],
      robust: [] as number[],
    },
  };
  let history: number[] = [];
  for (const interval of intervals) {
    if (interval.disposition !== "usable") {
      history = [];
      continue;
    }
    for (const strategy of ["weighted", "baseline", "robust"] as const) {
      // Current reported preferences have no historic timestamp. Exclude cold-start
      // prior forecasts from retrospective metrics to avoid hindsight leakage.
      const estimate = estimateLength(history, null, decay, strategy);
      if (estimate) {
        const error = Math.abs(
          Math.floor(estimate.length + 0.5) - interval.days,
        );
        errors[strategy].push(error);
        const group =
          history.length < 3
            ? "coldStart"
            : estimate.variable
              ? "variable"
              : "regular";
        groups[group][strategy].push(error);
      }
    }
    history.push(interval.days);
  }
  void reported;
  const compare = (group: typeof errors) => ({
    weighted: accuracy(group.weighted),
    baseline: accuracy(group.baseline),
    robust: accuracy(group.robust),
  });
  return {
    ...compare(errors),
    byHistory: {
      coldStart: compare(groups.coldStart),
      regular: compare(groups.regular),
      variable: compare(groups.variable),
    },
  };
}
export function predictionRegime(
  preferences: CyclePreferences,
  segmentStart: string | null = null,
) {
  return JSON.stringify([
    preferences.reportedCycleLength,
    preferences.context,
    preferences.historyStartDate,
    segmentStart,
  ]);
}
export function predictNextPeriod(
  records: CycleStart[],
  preferences: CyclePreferences,
  today: string,
  evaluations: PredictionEvaluation[] = [],
  decay = CONFIG.decay,
): Prediction {
  if (!(decay > 0 && decay <= 1)) throw new RangeError("Invalid decay");
  if (preferences.reportedCycleLength !== null)
    estimateLength([], preferences.reportedCycleLength, decay);
  const { dates, intervals, segment } = reconstructCycles(
    records,
    today,
    preferences.historyStartDate,
  );
  const report = backtest(intervals, preferences.reportedCycleLength, decay);
  const lastBreak = intervals.map((x) => x.disposition).lastIndexOf("missing");
  const regime = predictionRegime(
    preferences,
    lastBreak >= 0 ? intervals[lastBreak].endDate : dates[0]?.startDate || null,
  );
  const relevantErrors = evaluations.filter(
    (x) => x.modelVersion === MODEL_VERSION && x.regime === regime,
  );
  const observed = accuracy(
    relevantErrors.map((x) => x.absoluteErrorDays),
    relevantErrors.map((x) => x.windowCovered),
  );
  const groupAccuracy = (group: PredictionEvaluation["historyGroup"]) => {
    const values = relevantErrors.filter((x) => x.historyGroup === group);
    return accuracy(
      values.map((x) => x.absoluteErrorDays),
      values.map((x) => x.windowCovered),
    );
  };
  const base: Prediction = {
    modelVersion: MODEL_VERSION,
    regime,
    status: "needs_consent",
    anchorPeriodId: dates.at(-1)?.id || null,
    anchorStartDate: dates.at(-1)?.startDate || null,
    predictedDate: null,
    estimatedCycleLength: null,
    completedCycles: segment.filter((x) => x.disposition === "usable").length,
    method: null,
    variabilityDays: null,
    reliability: "unavailable",
    windowStart: null,
    windowEnd: null,
    uncertaintyStatus: "requires_calibration",
    calibrationSamples: 0,
    accuracy: observed,
    accuracyByHistory: {
      coldStart: groupAccuracy("coldStart"),
      regular: groupAccuracy("regular"),
      variable: groupAccuracy("variable"),
    },
    backtest: report,
    intervals,
  };
  if (!preferences.consent) return base;
  if (preferences.context === "not_provided")
    return { ...base, status: "context_needed" };
  if (preferences.context !== "none")
    return { ...base, status: "context_paused" };
  if (!dates.length) return { ...base, status: "needs_last_period" };
  if (segment.some((x) => x.disposition === "review"))
    return { ...base, status: "history_needs_review" };
  const lengths = segment.map((x) => x.days);
  const weighted = estimateLength(
    lengths,
    preferences.reportedCycleLength,
    decay,
  );
  if (!weighted) return { ...base, status: "needs_reported_length" };
  let strategy: "weighted" | "baseline" | "robust" = weighted.variable
    ? "robust"
    : "weighted";
  // Prefer the simpler baseline if recency weighting does not improve the measured backtest.
  const comparison = backtest(segment, preferences.reportedCycleLength, decay);
  if (
    comparison.weighted.evaluated >= CONFIG.minComparison &&
    comparison.baseline.maeDays! <=
      (weighted.variable
        ? comparison.robust.maeDays!
        : comparison.weighted.maeDays!)
  )
    strategy = "baseline";
  const estimate = estimateLength(
    lengths,
    preferences.reportedCycleLength,
    decay,
    strategy,
  )!;
  const predictedDate = addDays(
    dates.at(-1)!.startDate,
    Math.floor(estimate.length + 0.5),
  );
  const result: Prediction = {
    ...base,
    status: "estimated",
    predictedDate,
    estimatedCycleLength: Number(estimate.length.toFixed(2)),
    method: estimate.method,
    variabilityDays: Number(estimate.sd.toFixed(2)),
    reliability: estimate.variable
      ? "low_predictability"
      : lengths.length === 0
        ? "preliminary"
        : lengths.length < 3
          ? "limited_history"
          : observed.evaluated
            ? "observed_accuracy"
            : "personalized",
  };
  // No invented window or confidence percentage. Only genuine saved forecasts can calibrate.
  const calibration = relevantErrors.slice(-20);
  if (lengths.length >= 6 && calibration.length >= CONFIG.minCalibration) {
    const sorted = calibration
      .map((x) => x.absoluteErrorDays)
      .sort((a, b) => a - b);
    const radius = Math.ceil(
      Math.max(
        2,
        sorted[Math.ceil(0.8 * sorted.length) - 1],
        estimate.sd,
        estimate.variable ? 7 : 0,
      ),
    );
    result.windowStart = addDays(predictedDate, -radius);
    result.windowEnd = addDays(predictedDate, radius);
    result.uncertaintyStatus = "empirical_estimate";
    result.calibrationSamples = calibration.length;
  }
  return result;
}
