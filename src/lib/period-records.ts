import { validDate, includesDate } from "./calendar";
import type { PeriodLog } from "./period-store";
export function loggedOnDate(log: PeriodLog, date: string) {
  return includesDate(log, date) || !!log.entries?.some((e) => e.date === date);
}
export function periodForDate(logs: PeriodLog[], date: string) {
  return logs.find(
    (log) =>
      loggedOnDate(log, date) ||
      (log.ongoing === true && log.startDate <= date),
  );
}
export function dailyEntry(log: PeriodLog, date: string) {
  return log.entries?.find((e) => e.date === date) ?? log;
}
export function validatePeriod(
  log: PeriodLog,
  logs: PeriodLog[],
  today: string,
): "validDates" | "overlap" | null {
  if (
    !validDate(log.startDate) ||
    log.startDate > today ||
    (log.endDate &&
      (!validDate(log.endDate) ||
        log.endDate < log.startDate ||
        log.endDate > today)) ||
    !Number.isInteger(log.pain) ||
    log.pain < 0 ||
    log.pain > 10
  )
    return "validDates";
  // Legacy records without an end date mean unknown duration, not an indefinitely ongoing episode.
  const end = log.ongoing ? "9999-12-31" : log.endDate || log.startDate;
  if (
    logs.some(
      (x) =>
        x.id !== log.id &&
        x.startDate <= end &&
        log.startDate <= (x.ongoing ? "9999-12-31" : x.endDate || x.startDate),
    )
  )
    return "overlap";
  return null;
}
