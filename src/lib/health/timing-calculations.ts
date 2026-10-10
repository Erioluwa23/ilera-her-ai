import {
  addCalendarMonths,
  addDays,
  completedMonths,
  completedYears,
  daysBetween,
} from "./date-only";
export function latePeriodFacts(
  estimate: string | null,
  observedEnd: string | null,
  today: string,
  sexDate?: string,
) {
  if (sexDate && daysBetween(sexDate, today) < 0)
    throw new RangeError("Actual event cannot be in the future.");
  const testDate = sexDate ? addDays(sexDate, 21) : null;
  return {
    beyondMedian: estimate ? Math.max(0, daysBetween(estimate, today)) : null,
    beyondObservedRange: observedEnd
      ? Math.max(0, daysBetween(observedEnd, today))
      : null,
    testDate,
    eligibleBySexDate: testDate ? today >= testDate : null,
  };
}
export function conceptionFacts(
  start: string | undefined,
  birth: string | undefined,
  today: string,
  checked: number,
  applicable: number,
) {
  if (
    !Number.isInteger(checked) ||
    !Number.isInteger(applicable) ||
    checked < 0 ||
    checked > applicable
  )
    throw new RangeError("Invalid checklist progress.");
  const age = birth ? completedYears(birth, today) : null,
    threshold = age === null ? null : age < 35 ? 12 : age < 40 ? 6 : 0;
  return {
    months: start ? completedMonths(start, today) : null,
    age,
    checklistProgress: applicable ? checked / applicable : null,
    candidateMilestone:
      start && threshold !== null ? addCalendarMonths(start, threshold) : null,
  };
}
