export const DAY = 86_400_000;
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 2199) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function ordinal(value: string) {
  if (!validDate(value))
    throw new RangeError("Choose a valid calendar date (1900–2199).");
  return Date.parse(value + "T00:00:00Z") / DAY;
}
export function daysBetween(start: string, end: string) {
  return ordinal(end) - ordinal(start);
}
export function addDays(value: string, days: number) {
  if (!Number.isInteger(days)) throw new RangeError("Days must be an integer.");
  const result = new Date((ordinal(value) + days) * DAY)
    .toISOString()
    .slice(0, 10);
  ordinal(result);
  return result;
}
export function todayIn(timeZone = "Africa/Lagos", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function addCalendarMonths(value: string, months: number) {
  ordinal(value);
  if (!Number.isInteger(months))
    throw new RangeError("Months must be an integer.");
  const [year, month, day] = value.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  const result = first.toISOString().slice(0, 10);
  ordinal(result);
  return result;
}
// Leap-day anniversaries clamp to 28 February in non-leap years.
export function completedMonths(start: string, asOf: string) {
  if (daysBetween(start, asOf) < 0)
    throw new RangeError("The start cannot be in the future.");
  let months =
    (Number(asOf.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
    Number(asOf.slice(5, 7)) -
    Number(start.slice(5, 7));
  if (addCalendarMonths(start, months) > asOf) months--;
  return months;
}
export function completedYears(start: string, asOf: string) {
  return Math.floor(completedMonths(start, asOf) / 12);
}
export function displayDate(value: string, language = "en-NG") {
  ordinal(value);
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}
