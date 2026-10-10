import { completedMonths, daysBetween } from "./date-only";
export function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError("Enter a positive finite measurement.");
  return value;
}
export function weightKg(
  value: number,
  unit: "kg" | "g" | "lb" | "lb_oz",
  ounces = 0,
) {
  if (unit === "lb_oz") {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError("Pounds cannot be negative.");
    positive(value + ounces / 16);
  } else positive(value);
  if (!Number.isFinite(ounces) || ounces < 0 || ounces >= 16)
    throw new RangeError("Ounces must be 0–15.");
  return unit === "kg"
    ? value
    : unit === "g"
      ? value / 1000
      : unit === "lb"
        ? value * 0.45359237
        : (value + ounces / 16) * 0.45359237;
}
export function lengthCm(value: number, unit: "cm" | "mm" | "in") {
  positive(value);
  return unit === "cm" ? value : unit === "mm" ? value / 10 : value * 2.54;
}
export function temperatureC(value: number, unit: "C" | "F") {
  if (!Number.isFinite(value)) throw new RangeError("Invalid temperature.");
  return unit === "C" ? value : ((value - 32) * 5) / 9;
}
export function babyAge(birth: string, asOf: string) {
  const days = daysBetween(birth, asOf);
  if (days < 0)
    throw new RangeError("Birth date cannot follow the event date.");
  return {
    days,
    weeks: Math.floor(days / 7),
    extraDays: days % 7,
    months: completedMonths(birth, asOf),
    newborn: days < 28,
  };
}
export function correctedAge(ageDays: number, weeks: number, extra: number) {
  if (
    !Number.isInteger(ageDays) ||
    ageDays < 0 ||
    !Number.isInteger(weeks) ||
    weeks < 0 ||
    weeks > 45 ||
    !Number.isInteger(extra) ||
    extra < 0 ||
    extra > 6
  )
    throw new RangeError("Invalid gestational age.");
  return ageDays - Math.max(0, 280 - (weeks * 7 + extra));
}
export function weightChange(
  a: { date: string; kg: number },
  b: { date: string; kg: number },
) {
  positive(a.kg);
  positive(b.kg);
  const days = daysBetween(a.date, b.date);
  if (days <= 0) return null;
  const grams = (b.kg - a.kg) * 1000;
  return {
    days,
    grams,
    gramsPerDay: grams / days,
    percent: (100 * (b.kg - a.kg)) / a.kg,
  };
}
export function birthWeightChange(birth: number, current: number) {
  positive(birth);
  positive(current);
  const percent = (100 * (current - birth)) / birth;
  return { percent, loss: Math.max(0, -percent) };
}
