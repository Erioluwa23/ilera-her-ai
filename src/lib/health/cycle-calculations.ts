import { addDays, daysBetween, validDate } from "./date-only";
import { POLICIES } from "./policies";
export type PeriodEpisode = {
  id: string;
  startDate: string;
  endDate?: string;
  confirmed?: boolean;
  uncertain?: boolean;
  gapBefore?: boolean;
  transition?: boolean;
  kind?: "period" | "spotting" | "other";
};
export type CycleContext = {
  pregnancy?: boolean | null;
  postpartum?: boolean | null;
  hormonal?: boolean | null;
  regular?: boolean | null;
};
export function periodDuration(start: string, end?: string) {
  if (!end) {
    if (!validDate(start)) throw new RangeError("Invalid start date.");
    return null;
  }
  const duration = daysBetween(start, end) + 1;
  if (duration < 1) throw new RangeError("End date cannot precede start.");
  return duration;
}
export function currentCycleDay(start: string, today: string) {
  const day = daysBetween(start, today) + 1;
  if (day < 1) throw new RangeError("Period start cannot be in the future.");
  return day;
}
const median = (values: number[]) => {
  const c = [...values].sort((a, b) => a - b);
  return c.length % 2
    ? c[Math.floor(c.length / 2)]
    : (c[c.length / 2 - 1] + c[c.length / 2]) / 2;
};
export function cycleForecast(
  records: PeriodEpisode[],
  today: string,
  context: CycleContext = {},
) {
  if (!validDate(today)) throw new RangeError("Invalid calculation date.");
  const reasons: string[] = [],
    sorted = [...records].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
  if (
    sorted.some(
      (r) =>
        !validDate(r.startDate) ||
        r.startDate > today ||
        (r.endDate &&
          (!validDate(r.endDate) ||
            r.endDate < r.startDate ||
            r.endDate > today)),
    )
  )
    reasons.push("invalid_dates");
  const unique = sorted.filter(
    (r, i) => i === 0 || r.startDate !== sorted[i - 1].startDate,
  );
  if (unique.length !== sorted.length) reasons.push("duplicate_starts");
  const recent = unique.slice(-(POLICIES.period.maximumIntervals + 1));
  const intervals = reasons.includes("invalid_dates")
    ? []
    : recent
        .slice(1)
        .map((r, i) => ({
          days: daysBetween(recent[i].startDate, r.startDate),
          ids: [recent[i].id, r.id],
          uncertain: !!(
            r.gapBefore ||
            r.uncertain ||
            recent[i].uncertain ||
            r.transition ||
            recent[i].transition ||
            r.confirmed === false ||
            recent[i].confirmed === false ||
            (r.kind && r.kind !== "period") ||
            (recent[i].kind && recent[i].kind !== "period")
          ),
        }));
  if (intervals.some((i) => i.uncertain))
    reasons.push("uncertain_or_missing_onset");
  if (
    intervals.some(
      (i) =>
        i.days < POLICIES.period.minimumDays ||
        i.days > POLICIES.period.maximumDays,
    )
  )
    reasons.push("interval_outside_policy");
  if (intervals.length < POLICIES.period.minimumIntervals)
    reasons.push("more_period_records_needed");
  const values = intervals.map((i) => i.days),
    observedMin = values.length ? Math.min(...values) : null,
    observedMax = values.length ? Math.max(...values) : null;
  if (
    observedMin !== null &&
    observedMax! - observedMin > POLICIES.period.maximumRange
  )
    reasons.push("variable_history");
  if (context.pregnancy || context.postpartum || context.hormonal)
    reasons.push("cycle_transition");
  const centre = values.length ? median(values) : null,
    estimatedLength = centre === null ? null : Math.floor(centre + 0.5),
    anchor = unique.at(-1)?.startDate;
  const allowed = reasons.length === 0 && !!anchor;
  return {
    methodVersion: POLICIES.period.version,
    reasons,
    recordIds: recent.map((r) => r.id),
    intervals,
    sampleCount: values.length,
    median: centre,
    MAD:
      centre === null ? null : median(values.map((x) => Math.abs(x - centre))),
    observedMin,
    observedMax,
    estimatedLength,
    anchor,
    estimatedNextStart: allowed ? addDays(anchor!, estimatedLength!) : null,
    observedRangeStart: allowed ? addDays(anchor!, observedMin!) : null,
    observedRangeEnd: allowed ? addDays(anchor!, observedMax!) : null,
  };
}
export function fertilityEstimate(
  records: PeriodEpisode[],
  today: string,
  context: CycleContext,
) {
  const recent = records.filter(
    (r) =>
      validDate(r.startDate) &&
      daysBetween(r.startDate, today) <= 365 &&
      r.startDate <= today,
  );
  const forecast = cycleForecast(recent, today, context),
    reasons = forecast.reasons.filter(
      (r) => r !== "more_period_records_needed",
    );
  if (records.some((r) => !validDate(r.startDate) || r.startDate > today))
    reasons.push("invalid_dates");
  if (
    recent.some(
      (r) =>
        r.uncertain ||
        r.gapBefore ||
        r.transition ||
        r.confirmed === false ||
        (r.kind && r.kind !== "period"),
    )
  )
    reasons.push("uncertain_or_missing_onset");
  const all = [...new Set(recent.map((r) => r.startDate))].sort(),
    intervals = all.slice(1).map((x, i) => daysBetween(all[i], x));
  if (intervals.length < 6) reasons.push("six_complete_cycles_needed");
  if (intervals.some((x) => x < 26 || x > 32))
    reasons.push("history_outside_standard_days");
  if (
    context.regular !== true ||
    context.pregnancy !== false ||
    context.postpartum !== false ||
    context.hormonal !== false
  )
    reasons.push("eligibility_unconfirmed");
  const anchor = all.at(-1),
    day = anchor ? currentCycleDay(anchor, today) : null;
  if (day !== null && day > 32) reasons.push("current_cycle_passed_day_32");
  const eligible = reasons.length === 0 && !!anchor;
  return {
    methodVersion: POLICIES.fertility.version,
    reasons: [...new Set(reasons)],
    day,
    start: eligible ? addDays(anchor!, 7) : null,
    end: eligible ? addDays(anchor!, 18) : null,
    status: !eligible
      ? "unable_to_estimate"
      : day! >= 8 && day! <= 19
        ? "within_estimated_calendar_window"
        : "outside_estimated_calendar_window",
  };
}
