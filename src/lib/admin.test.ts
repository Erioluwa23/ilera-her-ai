import { afterEach, describe, expect, it } from "vitest";
import { isAdminSession } from "./admin";

afterEach(() => {
  delete process.env.ADMIN_PHONE_NUMBERS;
});

describe("admin access", () => {
  const session = { sub: "1", phone: "+2348000000000", exp: 9999999999 };

  it("denies access when no admin phones are configured", () => {
    expect(isAdminSession(session)).toBe(false);
  });

  it("allows only configured phone numbers", () => {
    process.env.ADMIN_PHONE_NUMBERS = "+2348000000000,+2348111111111";
    expect(isAdminSession(session)).toBe(true);
    expect(isAdminSession({ ...session, phone: "+2348222222222" })).toBe(false);
  });

  it("denies an empty session", () => {
    process.env.ADMIN_PHONE_NUMBERS = "+2348000000000";
    expect(isAdminSession(null)).toBe(false);
  });
});
