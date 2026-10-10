import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { growthEligibility, lmsScore, normalCentile } from "./growth-reference";
const rows = readFileSync(
  new URL("../../../reference-fixtures/who-lms-oracle.csv", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [indicator, sex, index, L, M, S, x, z, flag, centile] = line
      .replaceAll('"', "")
      .split(",");
    return {
      indicator: indicator as "WAZ" | "LAZ" | "WLZ" | "HCZ",
      sex: Number(sex),
      index: Number(index),
      L: Number(L),
      M: Number(M),
      S: Number(S),
      x: Number(x),
      z: Number(z),
      flag: Number(flag),
      centile: Number(centile),
    };
  });
describe("independent WHO R 4.2.2 / pinned Anthro oracle", () => {
  it("covers 304 score cases, both reference sexes, four indicators and tails", () => {
    expect(rows.length).toBe(304);
    expect(new Set(rows.map((x) => x.sex)).size).toBe(2);
    expect(new Set(rows.map((x) => x.indicator)).size).toBe(4);
  });
  it.each(rows)("matches $indicator sex $sex index $index z $z", (fixture) => {
    const r = lmsScore(fixture.x, fixture, fixture.indicator);
    expect(Math.abs(r.zReference - fixture.z)).toBeLessThanOrEqual(0.01);
    expect(Number(r.flagged)).toBe(fixture.flag);
    expect(
      Math.abs(normalCentile(r.zReference) - fixture.centile),
    ).toBeLessThan(0.001);
    if (r.flagged) expect(r.centile).toBeNull();
  });
  it("preserves record-only boundaries and does not infer clinical absence", () => {
    const base = {
      ageDays: 730,
      sex: "male",
      term: "term",
      method: "standing",
      oedema: "no",
      lengthCm: 90,
    } as const;
    expect(growthEligibility(base).normalizedLength).toBe(90.7);
    expect(growthEligibility({ ...base, ageDays: 731 }).ageEligible).toBe(
      false,
    );
    expect(growthEligibility({ ...base, ageDays: 100 }).lengthEligible).toBe(
      false,
    );
    expect(
      growthEligibility({ ...base, oedema: "unknown" }).weightEligible,
    ).toBe(false);
    expect(growthEligibility({ ...base, term: "preterm" }).ageEligible).toBe(
      false,
    );
  });
});
