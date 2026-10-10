import { expect, it } from "vitest";
import { safeReturn } from "./return-route";
it.each([
  "https://evil.test/voice",
  "//evil.test",
  "/\\evil.test",
  "/unknown",
  "/api/auth/me",
  "/voice\n",
])("rejects unsafe return %s", (route) => expect(safeReturn(route)).toBe("/"));
it("preserves only compatible non-sensitive route fields", () => {
  expect(safeReturn("/log?date=2026-02-30&symptoms=private")).toBe("/log");
  expect(safeReturn("/log?date=2026-10-10&question=private")).toBe(
    "/log?date=2026-10-10",
  );
  expect(safeReturn("/voice?thread=thread_1&question=private")).toBe(
    "/voice?thread=thread_1",
  );
});
