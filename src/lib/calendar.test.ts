import { describe, it, expect } from "vitest";
import { validDate, monthDays, shiftMonth, includesDate } from "./calendar";
describe("interactive calendar dates", () => {
  it("preserves leap day and rejects impossible input", () => {
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2026-04-31")).toBe(false);
    expect(validDate("<script>")).toBe(false);
  });
  it("moves across year boundaries without skipping short months", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthDays(shiftMonth("2026-03", -1)).dates.at(-1)).toBe(
      "2026-02-28",
    );
  });
  it("aligns Sunday-first dates and supports leap February", () => {
    expect(monthDays("2026-10").offset).toBe(4);
    expect(monthDays("2024-02").dates).toHaveLength(29);
  });
  it("marks only the start when duration is unknown", () => {
    expect(includesDate({ startDate: "2026-10-01" }, "2026-10-02")).toBe(false);
  });
  it("marks recorded duration inclusively", () => {
    const log = { startDate: "2026-10-01", endDate: "2026-10-04" };
    expect(includesDate(log, "2026-10-01")).toBe(true);
    expect(includesDate(log, "2026-10-04")).toBe(true);
    expect(includesDate(log, "2026-10-05")).toBe(false);
  });
  it("rejects malformed month parameters", () =>
    expect(() => monthDays("2026-13")).toThrow());
});
