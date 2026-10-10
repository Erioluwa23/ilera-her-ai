import { addCalendarMonths, validDate } from "./date-only";
import { temperatureC } from "./baby-calculations";
export type TriState = "yes" | "no" | "unsure";
export type CareInputs = {
  fainting: TriState;
  severePain: TriState;
  pregnancyPossible: TriState;
  oneSidedPain: TriState;
  unusualBleeding: TriState;
  shoulderPain: TriState;
  missedThree: TriState;
};
// Review-pending candidates. Consumers must check POLICIES.care before publication.
export function latePeriodCare(input: CareInputs) {
  if (input.fainting === "yes" || input.severePain === "yes")
    return { action: "emergency", ruleId: "late-immediate-danger-v1" } as const;
  if (
    input.pregnancyPossible !== "no" &&
    [input.oneSidedPain, input.unusualBleeding, input.shoulderPain].includes(
      "yes",
    )
  )
    return {
      action: "prompt_assessment",
      ruleId: "late-pregnancy-concern-v1",
    } as const;
  if (input.missedThree === "yes")
    return { action: "appointment", ruleId: "late-missed-periods-v1" } as const;
  if (Object.values(input).includes("unsure"))
    return {
      action: "needs_clarification",
      ruleId: "late-unknown-v1",
    } as const;
  return {
    action: "general_information",
    ruleId: "late-completed-v1",
  } as const;
}
export function infantTemperatureCandidate(
  birth: string | null,
  eventDate: string,
  value: number | null,
  unit: "C" | "F",
  suspected: TriState,
) {
  if (
    !validDate(eventDate) ||
    (birth && (!validDate(birth) || birth > eventDate))
  )
    throw new RangeError("Invalid age/date.");
  if (!birth)
    return { action: "needs_clarification", ruleId: "age-needed" } as const;
  const underThreeMonths = eventDate < addCalendarMonths(birth, 3),
    normalized = value === null ? null : temperatureC(value, unit);
  if (
    underThreeMonths &&
    (suspected === "yes" || (normalized !== null && normalized >= 38 - 1e-10))
  )
    return {
      action: "prompt_assessment",
      ruleId: "infant-temperature-candidate",
    } as const;
  return {
    action: "needs_clarification",
    ruleId: "reviewed-care-table-needed",
  } as const;
}
