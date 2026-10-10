import { validDate } from "../calendar";
import { validatePeriod } from "../period-records";
import type { PeriodLog } from "../period-store";
import type { CyclePreferences } from "./types";

export class CycleError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export function parsePeriod(value: unknown, today: string): PeriodLog {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)
  )
    throw new CycleError("invalid_period");
  const parseEntry = (entry: Record<string, unknown>) => {
    if (
      !["spotting", "light", "medium", "heavy"].includes(String(entry.flow)) ||
      !Number.isInteger(entry.pain) ||
      Number(entry.pain) < 0 ||
      Number(entry.pain) > 10
    )
      throw new CycleError("invalid_period");
    if (
      entry.notes !== undefined &&
      (typeof entry.notes !== "string" || entry.notes.length > 2000)
    )
      throw new CycleError("invalid_period");
    if (
      entry.symptoms !== undefined &&
      (!Array.isArray(entry.symptoms) ||
        entry.symptoms.length > 20 ||
        entry.symptoms.some((s) => typeof s !== "string" || s.length > 100))
    )
      throw new CycleError("invalid_period");
    return {
      flow: entry.flow as PeriodLog["flow"],
      pain: Number(entry.pain),
      notes: entry.notes as string | undefined,
      symptoms: entry.symptoms as string[] | undefined,
    };
  };
  if (
    typeof value.startDate !== "string" ||
    (value.endDate !== undefined && typeof value.endDate !== "string") ||
    (value.ongoing !== undefined && typeof value.ongoing !== "boolean") ||
    (value.ongoing === true && value.endDate)
  )
    throw new CycleError("invalid_period");
  if (
    value.previousCycle !== undefined &&
    !["unknown", "complete", "missing"].includes(String(value.previousCycle))
  )
    throw new CycleError("invalid_period");
  const log: PeriodLog = {
    id: value.id,
    startDate: value.startDate,
    endDate: value.endDate as string | undefined,
    ongoing: value.ongoing as boolean | undefined,
    previousCycle: value.previousCycle as PeriodLog["previousCycle"],
    ...parseEntry(value),
  };
  if (validatePeriod(log, [], today)) throw new CycleError("invalid_period");
  if (value.entries !== undefined) {
    if (!Array.isArray(value.entries) || value.entries.length > 366)
      throw new CycleError("invalid_period");
    log.entries = value.entries.map((entry) => {
      if (
        !object(entry) ||
        typeof entry.date !== "string" ||
        !validDate(entry.date) ||
        entry.date < log.startDate ||
        entry.date > today ||
        (log.endDate && entry.date > log.endDate)
      )
        throw new CycleError("invalid_period");
      return { date: entry.date, ...parseEntry(entry) };
    });
    if (new Set(log.entries.map((e) => e.date)).size !== log.entries.length)
      throw new CycleError("invalid_period");
  }
  return log;
}
export function parsePreferences(
  value: unknown,
  today: string,
): CyclePreferences {
  if (
    !object(value) ||
    value.consent !== true ||
    typeof value.reminderConsent !== "boolean"
  )
    throw new CycleError("consent_required");
  const length = (input: unknown, min: number, max: number) => {
    if (input === null) return null;
    if (!Number.isInteger(input) || Number(input) < min || Number(input) > max)
      throw new CycleError("invalid_preferences");
    return Number(input);
  };
  if (
    ![
      "not_provided",
      "none",
      "pregnancy",
      "postpartum",
      "breastfeeding",
      "hormonal",
      "major_change",
    ].includes(String(value.context))
  )
    throw new CycleError("invalid_preferences");
  if (
    value.historyStartDate !== null &&
    (typeof value.historyStartDate !== "string" ||
      !validDate(value.historyStartDate) ||
      value.historyStartDate > today)
  )
    throw new CycleError("invalid_preferences");
  return {
    consent: true,
    reportedCycleLength: length(value.reportedCycleLength, 15, 90),
    reportedPeriodLength: length(value.reportedPeriodLength, 1, 30),
    context: value.context as CyclePreferences["context"],
    historyStartDate: value.historyStartDate as string | null,
    reminderConsent: value.reminderConsent,
  };
}
