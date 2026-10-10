import { describe, expect, it } from "vitest";
import { parsePeriod, parsePreferences } from "./validation";
import { DEFAULT_PREFERENCES } from "./types";
const period = {
  id: "p1",
  startDate: "2026-10-01",
  endDate: "2026-10-04",
  flow: "medium",
  pain: 2,
};
describe("server cycle validation", () => {
  it("ignores client ownership and controlled storage metadata", () => {
    expect(
      parsePeriod(
        { ...period, user_id: "2", source: "admin", version: 99 },
        "2026-10-10",
      ),
    ).toEqual(
      expect.not.objectContaining({
        user_id: "2",
        source: "admin",
        version: 99,
      }),
    );
  });
  it.each([
    { startDate: "2026-02-30" },
    { startDate: "2026-10-11" },
    { pain: 11 },
    { pain: 1.5 },
    { flow: "unknown" },
    { ongoing: true },
    { previousCycle: "auto" },
    { notes: "x".repeat(2001) },
    { entries: [{ date: "2026-10-05", flow: "light", pain: 2 }] },
    { entries: [{ date: "2026-09-30", flow: "light", pain: 2 }] },
  ])("rejects invalid record %j", (changes) => {
    expect(() =>
      parsePeriod({ ...period, ...changes }, "2026-10-10"),
    ).toThrow();
  });
  it("preserves daily entries and missing-cycle annotations", () => {
    expect(
      parsePeriod(
        {
          ...period,
          previousCycle: "missing",
          entries: [
            { date: "2026-10-02", flow: "heavy", pain: 5, notes: "Second day" },
          ],
        },
        "2026-10-10",
      ),
    ).toMatchObject({
      previousCycle: "missing",
      entries: [{ date: "2026-10-02", notes: "Second day" }],
    });
  });
  it("does not opt a user into consent or reminders by default", () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({
      consent: false,
      reminderConsent: false,
      reportedCycleLength: null,
    });
    expect(() => parsePreferences(DEFAULT_PREFERENCES, "2026-10-10")).toThrow();
  });
});
