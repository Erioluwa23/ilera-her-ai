import { expect, it } from "vitest";
import { millisecondsToLagosMidnight } from "./use-today";
it("refreshes local Today at Lagos midnight across leap and year boundaries", () => {
  expect(millisecondsToLagosMidnight(new Date("2026-10-10T22:59:59Z"))).toBe(
    1000,
  );
  expect(millisecondsToLagosMidnight(new Date("2024-02-28T23:00:00Z"))).toBe(
    86400000,
  );
  expect(
    millisecondsToLagosMidnight(new Date("2026-12-31T22:59:59.999Z")),
  ).toBe(1);
});
