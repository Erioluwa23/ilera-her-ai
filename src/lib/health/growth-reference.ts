import { positive } from "./baby-calculations";
export type LMS = { L: number; M: number; S: number };
export function roundWHO(value: number, digits = 2) {
  const factor = 10 ** digits,
    scaled = value * factor,
    floor = Math.floor(scaled),
    diff = scaled - floor;
  const result =
    (Math.abs(diff - 0.5) < 1e-10
      ? floor % 2 === 0
        ? floor
        : floor + 1
      : Math.round(scaled)) / factor;
  return result === 0 ? 0 : result;
}
export function referenceValue(z: number, { L, M, S }: LMS) {
  if (
    ![z, L, M, S].every(Number.isFinite) ||
    M <= 0 ||
    S <= 0 ||
    (L !== 0 && 1 + L * S * z <= 0)
  )
    throw new RangeError("Reference unavailable.");
  return L === 0 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L);
}
// Arithmetic contract only. No comparison is published without validated tables and oracle.
export function lmsScore(
  x: number,
  coefficients: LMS,
  indicator: "WAZ" | "LAZ" | "WLZ" | "HCZ",
) {
  positive(x);
  positive(coefficients.M);
  positive(coefficients.S);
  if (!Number.isFinite(coefficients.L))
    throw new RangeError("Reference unavailable.");
  const { L, M, S } = coefficients,
    basic = L === 0 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
  let final = basic;
  if (indicator === "WAZ" || indicator === "WLZ") {
    if (basic > 3)
      final =
        3 +
        (x - referenceValue(3, coefficients)) /
          (referenceValue(3, coefficients) - referenceValue(2, coefficients));
    if (basic < -3)
      final =
        -3 +
        (x - referenceValue(-3, coefficients)) /
          (referenceValue(-2, coefficients) - referenceValue(-3, coefficients));
  }
  if (!Number.isFinite(final)) throw new RangeError("Reference unavailable.");
  const zReference = roundWHO(final),
    [low, high] =
      indicator === "LAZ" ? [-6, 6] : indicator === "WAZ" ? [-6, 5] : [-5, 5];
  const flagged = zReference < low || zReference > high;
  return {
    basic,
    final,
    zReference,
    flagged,
    centile: flagged ? null : normalCentile(zReference),
  };
}
export function normalCentile(z: number) {
  if (!Number.isFinite(z)) throw new RangeError("Invalid reference score.");
  const sign = z < 0 ? -1 : 1,
    x = Math.abs(z) / Math.SQRT2,
    t = 1 / (1 + 0.3275911 * x);
  const erf =
    sign *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x));
  return 50 * (1 + erf);
}
export function displayCentile(value: number) {
  return value < 0.1 ? "<0.1" : value > 99.9 ? ">99.9" : value.toFixed(1);
}
export function growthEligibility(input: {
  ageDays: number | null;
  sex: "male" | "female" | "unknown";
  term: "term" | "preterm" | "unknown";
  method: "recumbent" | "standing" | "unknown";
  oedema: "yes" | "no" | "unknown";
  lengthCm?: number;
}) {
  const reasons: string[] = [];
  if (
    input.ageDays === null ||
    !Number.isInteger(input.ageDays) ||
    input.ageDays < 0 ||
    input.ageDays > 730
  )
    reasons.push("age_outside_first_release");
  if (input.sex === "unknown") reasons.push("reference_sex_unknown");
  if (input.term !== "term") reasons.push("term_birth_unconfirmed");
  const lengthReasons: string[] = [];
  if (input.method === "unknown")
    lengthReasons.push("measurement_method_unknown");
  if (
    input.method === "standing" &&
    input.ageDays !== null &&
    input.ageDays / 30.4375 < 9
  )
    lengthReasons.push("young_infant_standing_measurement");
  const normalizedLength =
    input.lengthCm === undefined
      ? null
      : input.lengthCm +
        (input.method === "standing" &&
        !lengthReasons.length &&
        input.ageDays! <= 730
          ? 0.7
          : 0);
  const weightReasons =
    input.oedema !== "no"
      ? [input.oedema === "yes" ? "oedema_reported" : "oedema_unknown"]
      : [];
  return {
    reasons,
    lengthReasons,
    weightReasons,
    normalizedLength,
    ageEligible: reasons.length === 0,
    lengthEligible: reasons.length === 0 && lengthReasons.length === 0,
    weightEligible: reasons.length === 0 && weightReasons.length === 0,
  };
}
export function interpolateLMS(length: number, rows: Map<number, LMS>) {
  if (!Number.isFinite(length) || length < 45 || length > 110) return null;
  const scaled = length * 10,
    nearest = Math.round(scaled),
    exact = Math.abs(scaled - nearest) < 1e-10,
    index = exact ? nearest : Math.floor(scaled),
    lower = rows.get(index);
  if (!lower) return null;
  if (exact) return lower;
  const upper = rows.get(index + 1);
  if (!upper) return null;
  const fraction = scaled - index;
  return {
    L: lower.L + fraction * (upper.L - lower.L),
    M: lower.M + fraction * (upper.M - lower.M),
    S: lower.S + fraction * (upper.S - lower.S),
  };
}
