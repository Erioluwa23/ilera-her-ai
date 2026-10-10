import { validDate } from "./date-only";
export type Review = {
  status: "draft" | "approved" | "retired";
  reviewer: string | null;
  reviewedOn: string | null;
  expiresOn: string | null;
};
const pending: Review = {
  status: "draft",
  reviewer: null,
  reviewedOn: null,
  expiresOn: null,
};
export const POLICIES = {
  period: {
    ...pending,
    version: "cycle-median-v1",
    minimumIntervals: 3,
    maximumIntervals: 6,
    minimumDays: 15,
    maximumDays: 60,
    maximumRange: 7,
  },
  fertility: {
    ...pending,
    version: "standard-days-calendar-v1",
    minimumIntervals: 6,
  },
  lmp: { ...pending, version: "lmp-280-v1" },
  adjustedLmp: { ...pending, version: "lmp-adjusted-v1" },
  care: { ...pending, version: "care-candidates-v1" },
  growth: {
    ...pending,
    version: "who-anthro-v1",
    referencePin: "b776d8a12b1c97369c748b561159fd2ec4f4db58",
  },
} as const;
export function publishable(review: Review, asOf: string) {
  return (
    review.status === "approved" &&
    !!review.reviewer &&
    validDate(review.reviewedOn) &&
    review.reviewedOn <= asOf &&
    validDate(review.expiresOn) &&
    review.reviewedOn <= review.expiresOn &&
    validDate(asOf) &&
    asOf <= review.expiresOn
  );
}
