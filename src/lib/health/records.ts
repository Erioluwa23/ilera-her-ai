import { validDate, todayIn } from "./date-only";
import { weightKg, lengthCm } from "./baby-calculations";
import type { PeriodEpisode } from "./cycle-calculations";
export type Flow = "spotting" | "light" | "medium" | "heavy";
export type PeriodLog = PeriodEpisode & {
  flow: Flow | null;
  pain: number | null;
  notes?: string;
  symptoms?: string[];
  endStatus?: "ongoing" | "unknown" | "ended";
  revision?: number;
  source?: string;
  updatedAt?: string;
};
export type Pregnancy = {
  id: string;
  status: "active" | "paused" | "ended";
  clinicianEDD?: string;
  lmp?: string;
  reliable?: boolean | null;
  regular?: boolean | null;
  usualLength?: number | null;
  updatedAt: string;
  changes: {
    at: string;
    oldEDD: string | null;
    newEDD: string | null;
    basis: string;
  }[];
};
export type Baby = {
  id: string;
  name: string;
  birthDate: string;
  referenceSex: "female" | "male" | "unknown";
  term: "term" | "preterm" | "unknown";
  birthWeeks?: number;
  birthExtraDays?: number;
};
export type Measurement = {
  id: string;
  babyId: string;
  date: string;
  measure: "weight" | "length" | "head";
  value: number;
  unit: "kg" | "g" | "lb" | "cm" | "mm" | "in";
  normalized: number;
  method: "recumbent" | "standing" | "scale" | "tape" | "unknown";
  source: "home" | "provider" | "unknown";
  confirmed: true;
  revision: number;
};
export type Appointment = {
  id: string;
  pregnancyId?: string;
  babyId?: string;
  date: string;
  time: string;
  timezone: string;
};
export type Conception = {
  id: string;
  startDate: string;
  pauses: "yes" | "no" | "unknown";
  checked: string[];
  changes?: { at: string; startDate: string }[];
};
export type TestRecord = {
  id: string;
  date: string;
  result: "positive" | "negative" | "unclear";
  sexDate?: string;
};
export type HealthData = {
  version: 3;
  revision: number;
  periods: PeriodLog[];
  pregnancies: Pregnancy[];
  babies: Baby[];
  measurements: Measurement[];
  appointments: Appointment[];
  conception: Conception[];
  tests: TestRecord[];
};
export const emptyHealthData = (): HealthData => ({
  version: 3,
  revision: 0,
  periods: [],
  pregnancies: [],
  babies: [],
  measurements: [],
  appointments: [],
  conception: [],
  tests: [],
});
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const id = (x: unknown) =>
  typeof x === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(x);
const actualDate = (x: unknown, today: string) => validDate(x) && x <= today;
const listOfStrings = (x: unknown) =>
  Array.isArray(x) &&
  x.length <= 30 &&
  x.every((v) => typeof v === "string" && v.length <= 100);
const optionalBoolean = (x: unknown) =>
  x === undefined || typeof x === "boolean";
const nullableBoolean = (x: unknown) => x === null || optionalBoolean(x);
export function validatePeriod(x: unknown, today = todayIn()): x is PeriodLog {
  return (
    object(x) &&
    id(x.id) &&
    actualDate(x.startDate, today) &&
    (x.endDate === undefined ||
      (actualDate(x.endDate, today) &&
        String(x.endDate) >= String(x.startDate))) &&
    (x.flow === null ||
      ["spotting", "light", "medium", "heavy"].includes(String(x.flow))) &&
    (x.pain === null ||
      (Number.isInteger(x.pain) &&
        Number(x.pain) >= 0 &&
        Number(x.pain) <= 10)) &&
    (x.notes === undefined || typeof x.notes === "string") &&
    (x.symptoms === undefined || listOfStrings(x.symptoms)) &&
    [x.confirmed, x.uncertain, x.gapBefore, x.transition].every(
      optionalBoolean,
    ) &&
    (x.kind === undefined ||
      ["period", "spotting", "other"].includes(String(x.kind))) &&
    (x.endStatus === undefined ||
      ["ongoing", "unknown", "ended"].includes(String(x.endStatus))) &&
    (x.revision === undefined ||
      (Number.isInteger(x.revision) && Number(x.revision) >= 1))
  );
}
export function validateHealthData(
  value: unknown,
  today = todayIn(),
): HealthData {
  if (
    !object(value) ||
    value.version !== 3 ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 0
  )
    throw new Error("Unsupported or invalid data file. Expected version 3.");
  const result = emptyHealthData();
  result.revision = Number(value.revision);
  for (const key of [
    "periods",
    "pregnancies",
    "babies",
    "measurements",
    "appointments",
    "conception",
    "tests",
  ] as const) {
    const rows = value[key];
    if (
      !Array.isArray(rows) ||
      rows.length > 5000 ||
      rows.some((x) => !object(x) || !id(x.id)) ||
      new Set(rows.map((x) => x.id)).size !== rows.length
    )
      throw new Error("Invalid or duplicated record identifiers.");
  }
  if (!(value.periods as unknown[]).every((x) => validatePeriod(x, today)))
    throw new Error("Invalid period date or details.");
  for (const x of value.pregnancies as Record<string, unknown>[]) {
    if (
      !nullableBoolean(x.reliable) ||
      !nullableBoolean(x.regular) ||
      (x.usualLength !== undefined &&
        x.usualLength !== null &&
        (!Number.isInteger(x.usualLength) ||
          Number(x.usualLength) < 1 ||
          Number(x.usualLength) > 120))
    )
      throw new Error("Invalid pregnancy dating input.");
    if (
      !["active", "paused", "ended"].includes(String(x.status)) ||
      (x.clinicianEDD !== undefined && !validDate(x.clinicianEDD)) ||
      (x.lmp !== undefined && !actualDate(x.lmp, today)) ||
      typeof x.updatedAt !== "string" ||
      !Array.isArray(x.changes) ||
      x.changes.some(
        (c) =>
          !object(c) ||
          typeof c.at !== "string" ||
          typeof c.basis !== "string" ||
          (c.oldEDD !== null && !validDate(c.oldEDD)) ||
          (c.newEDD !== null && !validDate(c.newEDD)),
      )
    )
      throw new Error("Invalid pregnancy record.");
  }
  for (const x of value.babies as Record<string, unknown>[]) {
    if (
      typeof x.name !== "string" ||
      x.name.length > 80 ||
      !actualDate(x.birthDate, today) ||
      !["female", "male", "unknown"].includes(String(x.referenceSex)) ||
      !["term", "preterm", "unknown"].includes(String(x.term)) ||
      (x.birthWeeks !== undefined &&
        (!Number.isInteger(x.birthWeeks) ||
          Number(x.birthWeeks) < 0 ||
          Number(x.birthWeeks) > 45)) ||
      (x.birthExtraDays !== undefined &&
        (!Number.isInteger(x.birthExtraDays) ||
          Number(x.birthExtraDays) < 0 ||
          Number(x.birthExtraDays) > 6))
    )
      throw new Error("Invalid child profile.");
  }
  const babies = value.babies as Baby[];
  for (const x of value.measurements as Measurement[]) {
    const baby = babies.find((b) => b.id === x.babyId);
    if (
      !baby ||
      !actualDate(x.date, today) ||
      x.date < baby.birthDate ||
      x.confirmed !== true ||
      !Number.isInteger(x.revision) ||
      x.revision < 1 ||
      !["recumbent", "standing", "scale", "tape", "unknown"].includes(
        x.method,
      ) ||
      !["home", "provider", "unknown"].includes(x.source)
    )
      throw new Error(
        "Measurement needs its child, date and confirmed method/source.",
      );
    let normalized: number;
    if (x.measure === "weight" && ["kg", "g", "lb"].includes(x.unit))
      normalized = weightKg(x.value, x.unit as "kg" | "g" | "lb");
    else if (
      ["length", "head"].includes(x.measure) &&
      ["cm", "mm", "in"].includes(x.unit)
    )
      normalized = lengthCm(x.value, x.unit as "cm" | "mm" | "in");
    else throw new Error("Measurement and unit do not match.");
    const methods =
      x.measure === "weight"
        ? ["unknown", "scale"]
        : x.measure === "head"
          ? ["unknown", "tape"]
          : ["unknown", "standing", "recumbent"];
    if (
      !methods.includes(x.method) ||
      !Number.isFinite(x.normalized) ||
      Math.abs(normalized - x.normalized) > 1e-8
    )
      throw new Error(
        "Measurement method or conversion does not match the original value.",
      );
  }
  for (const x of value.conception as Conception[])
    if (
      !actualDate(x.startDate, today) ||
      !["yes", "no", "unknown"].includes(x.pauses) ||
      !listOfStrings(x.checked) ||
      (x.changes !== undefined &&
        (!Array.isArray(x.changes) ||
          x.changes.some(
            (c) =>
              !object(c) ||
              typeof c.at !== "string" ||
              !actualDate(c.startDate, today),
          )))
    )
      throw new Error("Invalid trying-to-conceive record.");
  for (const x of value.tests as TestRecord[])
    if (
      !actualDate(x.date, today) ||
      !["positive", "negative", "unclear"].includes(x.result) ||
      (x.sexDate !== undefined &&
        (!actualDate(x.sexDate, today) || x.sexDate > x.date))
    )
      throw new Error("Invalid test record.");
  for (const x of value.appointments as Appointment[]) {
    if (
      !validDate(x.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ||
      typeof x.timezone !== "string" ||
      !!x.babyId === !!x.pregnancyId ||
      (x.babyId && !babies.some((b) => b.id === x.babyId)) ||
      (x.pregnancyId &&
        !(value.pregnancies as Pregnancy[]).some((p) => p.id === x.pregnancyId))
    )
      throw new Error("Invalid appointment.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: x.timezone });
    } catch {
      throw new Error("Invalid appointment timezone.");
    }
  }
  return {
    ...result,
    periods: value.periods as PeriodLog[],
    pregnancies: value.pregnancies as Pregnancy[],
    babies,
    measurements: value.measurements as Measurement[],
    appointments: value.appointments as Appointment[],
    conception: value.conception as Conception[],
    tests: value.tests as TestRecord[],
  };
}
export function assertPeriodConflict(periods: PeriodLog[], record: PeriodLog) {
  const conflict = periods.find(
    (x) =>
      x.id !== record.id &&
      x.startDate <= (record.endDate || record.startDate) &&
      record.startDate <= (x.endDate || x.startDate),
  );
  if (conflict)
    throw new Error(
      "These dates overlap the saved period beginning " +
        conflict.startDate +
        ". Open that record to correct it.",
    );
}
export function mergeHealthData(current: HealthData, incoming: HealthData) {
  const next = structuredClone(current);
  for (const key of [
    "periods",
    "pregnancies",
    "babies",
    "measurements",
    "appointments",
    "conception",
    "tests",
  ] as const) {
    for (const record of incoming[key]) {
      const original = (next[key] as { id: string }[]).find(
        (x) => x.id === record.id,
      );
      if (original && JSON.stringify(original) !== JSON.stringify(record))
        throw new Error(
          "Conflicting record " +
            record.id +
            ". Keep existing data or restore into a separate account.",
        );
      if (!original) {
        if (key === "periods")
          assertPeriodConflict(next.periods, record as PeriodLog);
        (next[key] as { id: string }[]).push(record);
      }
    }
  }
  return validateHealthData(next);
}
