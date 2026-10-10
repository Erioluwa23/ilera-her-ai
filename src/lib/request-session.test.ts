import { afterEach, expect, it, vi } from "vitest";
import { createSessionToken } from "./session";
import { requestSession } from "./request-session";
afterEach(() => vi.unstubAllEnvs());
it("requires a valid signed unexpired session for personal APIs", async () => {
  vi.stubEnv("AUTH_SECRET", "unit-fixture-secret-only-ileraher-2026");
  expect(await requestSession(new Request("https://app"))).toBeNull();
  expect(
    await requestSession(
      new Request("https://app", {
        headers: { cookie: "ileraher_session=forged.invalid" },
      }),
    ),
  ).toBeNull();
  const token = await createSessionToken("one", "+2348000000000");
  expect(
    await requestSession(
      new Request("https://app", {
        headers: { cookie: "ileraher_session=" + token },
      }),
    ),
  ).toMatchObject({ sub: "one" });
});
