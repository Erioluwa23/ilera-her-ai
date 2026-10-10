import { describe, expect, it } from "vitest";
import { eligibleEvaluation } from "./store";
import { predictNextPeriod } from "./engine";
import { DEFAULT_PREFERENCES, type SavedPrediction } from "./types";
const forecast: SavedPrediction = {
  ...predictNextPeriod(
    [{ id: "p1", startDate: "2026-01-01" }],
    {
      ...DEFAULT_PREFERENCES,
      consent: true,
      context: "none",
      reportedCycleLength: 29,
    },
    "2026-01-02",
  ),
  id: "forecast",
  revision: 1,
  createdAt: "2026-01-02T10:00:00Z",
};
const actual = {
  id: "p2",
  startDate: "2026-01-31",
  flow: "light" as const,
  pain: 1,
};
describe("prospective outcome eligibility", () => {
  it("scores the original saved date rather than recalculating with the actual cycle", () => {
    expect(eligibleEvaluation(forecast, actual, "p1")).toMatchObject({
      absoluteErrorDays: 1,
      windowCovered: null,
      historyGroup: "coldStart",
    });
  });
  it("rejects a forecast made after local midnight even if its UTC date is earlier", () => {
    expect(
      eligibleEvaluation(
        { ...forecast, createdAt: "2026-01-30T23:10:00Z" },
        actual,
        "p1",
      ),
    ).toBeNull();
  });
  it("rejects historical starts, wrong anchors and missing period records", () => {
    expect(
      eligibleEvaluation(
        { ...forecast, createdAt: "2026-02-02T10:00:00Z" },
        actual,
        "p1",
      ),
    ).toBeNull();
    expect(eligibleEvaluation(forecast, actual, "other")).toBeNull();
    expect(
      eligibleEvaluation(
        forecast,
        { ...actual, previousCycle: "missing" },
        "p1",
      ),
    ).toBeNull();
  });
});
