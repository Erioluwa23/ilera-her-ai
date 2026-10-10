import { describe, expect, it } from "vitest";
import { averageCycleLength, predictedNextPeriod, cycleDay } from "./cycle";
describe("legacy cycle adapter uses validated median policy", () => {
  it("requires three complete intervals", () => {
    expect(
      averageCycleLength(["2026-06-01", "2026-06-30", "2026-07-29"]),
    ).toBeNull();
  });
  it("predicts from four confirmed starts", () => {
    const starts = ["2026-05-03", "2026-06-01", "2026-06-30", "2026-07-29"];
    expect(averageCycleLength(starts)).toBe(29);
    expect(predictedNextPeriod(starts)).toBe("2026-08-27");
  });
  it("keeps insufficient records unknown", () =>
    expect(averageCycleLength(["2026-06-01"])).toBeNull());
  it("counts signed date-only cycle days", () =>
    expect(cycleDay("2026-09-01", new Date("2026-09-05T12:00:00Z"))).toBe(5));
});
