import { expect, it } from "vitest";
import { reviewedContent } from "./content-registry";
import { publishable } from "./policies";
it("does not release candidate content or accept invalid sign-off dates", () => {
  for (const language of ["en-NG", "yo", "ha", "ig"] as const)
    expect(reviewedContent("newborn", language, "2026-10-10")).toEqual([]);
  expect(
    publishable(
      {
        status: "approved",
        reviewer: "Fixture",
        reviewedOn: "0000",
        expiresOn: "zzzz",
      },
      "2026-10-10",
    ),
  ).toBe(false);
  expect(
    publishable(
      {
        status: "approved",
        reviewer: "Fixture",
        reviewedOn: "2026-10-01",
        expiresOn: "2026-10-09",
      },
      "2026-10-10",
    ),
  ).toBe(false);
});
