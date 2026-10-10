import { validateHealthData } from "./records";
import { todayIn, displayDate } from "./date-only";
import { cycleForecast } from "./cycle-calculations";
import { pregnancyDates } from "./pregnancy-calculations";
import { babyAge } from "./baby-calculations";
import { completedMonths } from "./date-only";
import { recordResult } from "./record-result";
import type { HealthResult } from "./result-schema";

// Stateless boundary for device-owned records. Caller-supplied results, scores,
// care actions and calculation dates never become authoritative facts.
export function serverResult(input: unknown, asOf = todayIn()): HealthResult {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid result request.");
  const body = input as Record<string, unknown>,
    data = validateHealthData(body.records, asOf);
  const selectedId = typeof body.recordId === "string" ? body.recordId : "";
  const facts: HealthResult["facts"] = [];
  const fact = (
    id: string,
    value: number | string,
    unit: string | null,
    basis: string,
    estimated = false,
  ) =>
    facts.push({
      id,
      value,
      unit,
      basis,
      estimated,
      displayToken:
        typeof value === "number"
          ? value.toLocaleString("en-NG", { maximumFractionDigits: 4 }) +
            (unit ? " " + unit : "")
          : displayDate(value),
    });
  let ids: string[] = [],
    explanation = "",
    method = "",
    reasons: string[] = [];
  switch (body.topic) {
    case "period": {
      const cycle = cycleForecast(data.periods, asOf);
      ids = cycle.recordIds;
      method = cycle.methodVersion;
      fact(
        "sample_count",
        cycle.sampleCount,
        "recorded intervals",
        "Complete start-to-start intervals",
      );
      if (cycle.median !== null)
        fact(
          "observed_median",
          cycle.median,
          "days",
          "Median of recorded intervals",
        );
      reasons = ["forecast_policy_review_pending", ...cycle.reasons];
      explanation =
        "These facts describe recorded dates. Personal period forecasts are withheld while the policy awaits clinical review.";
      break;
    }
    case "pregnancy": {
      const record = data.pregnancies.find((x) => x.id === selectedId);
      if (!record) throw new Error("Pregnancy record not found.");
      ids = [record.id];
      method = "provider-edd-280-anchor-v1";
      const dating = pregnancyDates(
        { clinicianEDD: record.clinicianEDD, status: record.status },
        asOf,
      );
      if (dating.status === "ready") {
        fact(
          "edd",
          dating.edd!,
          null,
          "You entered a provider-supplied due date",
          true,
        );
        fact(
          "gestational_days",
          dating.ageDays!,
          "days",
          "Date arithmetic from the provider date you entered",
          true,
        );
      }
      reasons = ["lmp_and_care_policy_review_pending", dating.status];
      explanation =
        record.status === "active"
          ? "A provider date is preserved. Last-period estimates and stage guidance await review. Dates needing confirmation produce no countdown."
          : "Tracking is paused or ended. No gestational countdown is published.";
      break;
    }
    case "newborn": {
      const baby = data.babies.find((x) => x.id === selectedId);
      if (!baby) throw new Error("Child profile not found.");
      ids = [baby.id];
      method = "chronological-age-v1";
      fact(
        "age_days",
        babyAge(baby.birthDate, asOf).days,
        "days",
        "Actual birth date through today",
      );
      reasons = ["newborn_care_review_pending"];
      explanation =
        "Age arithmetic describes dates. No milestone or health assessment is made.";
      break;
    }
    case "growth": {
      const record = data.measurements.find((x) => x.id === selectedId);
      if (!record) throw new Error("Measurement not found.");
      ids = [record.id, record.babyId];
      method = "measurement-units-v1";
      fact(
        "measurement",
        record.normalized,
        record.measure === "weight" ? "kg" : "cm",
        "Confirmed original value and unit",
      );
      reasons = ["full_who_reference_release_pending"];
      explanation =
        "The measurement is recorded. Reference comparisons, percentiles and growth interpretation are unavailable.";
      break;
    }
    case "conception": {
      const record = data.conception.find((x) => x.id === selectedId);
      if (!record) throw new Error("Trying record not found.");
      ids = [record.id];
      method = "completed-calendar-months-v1";
      fact(
        "elapsed_months",
        completedMonths(record.startDate, asOf),
        "calendar months",
        "Elapsed calendar time; pauses have not been subtracted",
      );
      reasons = ["referral_policy_review_pending"];
      explanation =
        "This describes elapsed time, not active exposure or a probability of pregnancy. Discuss questions with a healthcare provider.";
      break;
    }
    default:
      throw new Error("Unsupported record-result topic.");
  }
  const result = recordResult(
    body.topic as HealthResult["topic"],
    method,
    ids,
    facts,
    explanation,
    reasons,
  );
  result.calculation.asOfDate = asOf;
  return result;
}
