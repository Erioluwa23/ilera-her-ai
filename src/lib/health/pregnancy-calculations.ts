import { addDays, daysBetween } from "./date-only";
export type PregnancyDating = {
  clinicianEDD?: string;
  lmp?: string;
  reliable?: boolean | null;
  regular?: boolean | null;
  usualLength?: number | null;
  status?: "active" | "paused" | "ended";
};
export function pregnancyDates(
  input: PregnancyDating,
  asOf: string,
  allowAdjustment = false,
) {
  if (input.status && input.status !== "active")
    return { status: "inactive" as const, edd: null, source: null };
  let edd = input.clinicianEDD,
    source: "provider" | "lmp" | "adjusted_lmp" | null = edd
      ? "provider"
      : null;
  if (
    !edd &&
    input.lmp &&
    input.reliable === true &&
    input.regular === true &&
    (input.usualLength === 28 ||
      (allowAdjustment &&
        Number.isInteger(input.usualLength) &&
        input.usualLength! >= 21 &&
        input.usualLength! <= 35))
  ) {
    if (daysBetween(input.lmp, asOf) < 0)
      throw new RangeError("Last period cannot be in the future.");
    edd = addDays(
      input.lmp,
      280 + (allowAdjustment ? input.usualLength! - 28 : 0),
    );
    source = input.usualLength === 28 ? "lmp" : "adjusted_lmp";
  }
  if (!edd) return { status: "unknown" as const, edd: null, source: null };
  const anchor = addDays(edd, -280),
    ageDays = daysBetween(anchor, asOf);
  return {
    status:
      ageDays < 0 || ageDays > 294
        ? ("needs_confirmation" as const)
        : ("ready" as const),
    edd,
    source,
    anchor,
    ageDays,
    weeks: Math.floor(ageDays / 7),
    extraDays: ((ageDays % 7) + 7) % 7,
    daysUntilEDD: daysBetween(asOf, edd),
    trimester: ageDays < 98 ? 1 : ageDays < 196 ? 2 : 3,
  };
}
