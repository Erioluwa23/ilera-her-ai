export const MODEL_VERSION = "pacpe-1.0.0";
export const CONSENT_VERSION = "cycle-storage-1";
export type CycleContext =
  | "not_provided"
  | "none"
  | "pregnancy"
  | "postpartum"
  | "breastfeeding"
  | "hormonal"
  | "major_change";
export type CyclePreferences = {
  consent: boolean;
  reportedCycleLength: number | null;
  reportedPeriodLength: number | null;
  context: CycleContext;
  historyStartDate: string | null;
  reminderConsent: boolean;
};
export const DEFAULT_PREFERENCES: CyclePreferences = {
  consent: false,
  reportedCycleLength: null,
  reportedPeriodLength: null,
  context: "not_provided",
  historyStartDate: null,
  reminderConsent: false,
};
export type CycleStart = {
  id: string;
  startDate: string;
  previousCycle?: "unknown" | "complete" | "missing";
};
export type CycleInterval = {
  fromId: string;
  toId: string;
  startDate: string;
  endDate: string;
  days: number;
  disposition: "usable" | "missing" | "review";
  reason?: "short_gap" | "long_gap" | "unconfirmed_gap";
};
export type ForecastMethod =
  | "reported_length"
  | "prior_smoothed"
  | "historical_mean"
  | "weighted_average"
  | "robust_median";
export type Accuracy = {
  evaluated: number;
  maeDays: number | null;
  withinThreeDays: number | null;
  windowEvaluated: number;
  windowCoverage: number | null;
};
export type ModelComparison = {
  weighted: Accuracy;
  baseline: Accuracy;
  robust: Accuracy;
};
export type BacktestReport = ModelComparison & {
  byHistory: {
    coldStart: ModelComparison;
    regular: ModelComparison;
    variable: ModelComparison;
  };
};
export type PredictionEvaluation = {
  predictionId: string;
  actualPeriodId: string;
  actualStartDate: string;
  absoluteErrorDays: number;
  windowCovered: boolean | null;
  modelVersion: string;
  // Preferences/segment must match before earlier errors inform a new window.
  regime: string;
  historyGroup: "coldStart" | "regular" | "variable";
};
export type Prediction = {
  modelVersion: string;
  regime: string;
  status:
    | "needs_consent"
    | "needs_last_period"
    | "needs_reported_length"
    | "context_needed"
    | "context_paused"
    | "history_needs_review"
    | "estimated";
  anchorPeriodId: string | null;
  anchorStartDate: string | null;
  predictedDate: string | null;
  estimatedCycleLength: number | null;
  completedCycles: number;
  method: ForecastMethod | null;
  variabilityDays: number | null;
  reliability:
    | "preliminary"
    | "limited_history"
    | "personalized"
    | "observed_accuracy"
    | "low_predictability"
    | "unavailable";
  windowStart: string | null;
  windowEnd: string | null;
  uncertaintyStatus: "requires_calibration" | "empirical_estimate";
  calibrationSamples: number;
  accuracy: Accuracy;
  accuracyByHistory: {
    coldStart: Accuracy;
    regular: Accuracy;
    variable: Accuracy;
  };
  backtest: BacktestReport;
  intervals: CycleInterval[];
};
export type SavedPrediction = Prediction & {
  id: string;
  createdAt: string;
  revision: number;
};
