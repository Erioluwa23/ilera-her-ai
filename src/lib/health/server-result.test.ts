import { describe, expect, it } from "vitest";
import { serverResult } from "./server-result";
import { emptyHealthData } from "./records";
describe("server-owned numerical facts", () => {
  it("recomputes periods without accepting a client date, facts, care action or forecast", () => {
    const records = emptyHealthData();
    records.periods = [
      "2026-01-01",
      "2026-01-30",
      "2026-02-28",
      "2026-03-29",
    ].map((startDate, i) => ({
      id: "p" + i,
      startDate,
      flow: null,
      pain: null,
    }));
    const result = serverResult(
      {
        topic: "period",
        records,
        asOf: "2099-01-01",
        careAction: "emergency",
        facts: [{ value: 2 }],
      },
      "2026-10-10",
    );
    expect(result.calculation.asOfDate).toBe("2026-10-10");
    expect(result.careAction).toBe("general_information");
    expect(result.facts.find((x) => x.id === "observed_median")?.value).toBe(
      29,
    );
    expect(result.status).toBe("record_only");
    expect(result.facts.some((x) => x.id === "forecast")).toBe(false);
  });
  it("withholds unapproved LMP estimates and paused gestational age", () => {
    const records = emptyHealthData();
    records.pregnancies = [
      {
        id: "p",
        status: "active",
        lmp: "2026-01-01",
        regular: true,
        reliable: true,
        usualLength: 28,
        updatedAt: "2026-10-10",
        changes: [],
      },
    ];
    expect(
      serverResult({ topic: "pregnancy", recordId: "p", records }, "2026-10-10")
        .facts,
    ).toEqual([]);
    records.pregnancies[0].clinicianEDD = "2026-12-20";
    expect(
      serverResult(
        { topic: "pregnancy", recordId: "p", records },
        "2026-10-10",
      ).facts.find((x) => x.id === "gestational_days")?.value,
    ).toBe(209);
    records.pregnancies[0].status = "paused";
    expect(
      serverResult({ topic: "pregnancy", recordId: "p", records }, "2026-10-10")
        .facts,
    ).toEqual([]);
  });
  it("rejects forged normalization and orphan measurements", () => {
    const records = emptyHealthData();
    records.babies = [
      {
        id: "b",
        name: "",
        birthDate: "2026-10-01",
        term: "unknown",
        referenceSex: "unknown",
      },
    ];
    records.measurements = [
      {
        id: "m",
        babyId: "b",
        date: "2026-10-10",
        measure: "weight",
        value: 3500,
        unit: "g",
        normalized: 3500,
        method: "unknown",
        source: "unknown",
        confirmed: true,
        revision: 1,
      },
    ];
    expect(() =>
      serverResult({ topic: "growth", recordId: "m", records }, "2026-10-10"),
    ).toThrow();
    records.measurements[0].normalized = 3.5;
    expect(
      serverResult({ topic: "growth", recordId: "m", records }, "2026-10-10")
        .facts[0].value,
    ).toBe(3.5);
    records.babies = [];
    expect(() =>
      serverResult({ topic: "growth", recordId: "m", records }, "2026-10-10"),
    ).toThrow();
  });
});
