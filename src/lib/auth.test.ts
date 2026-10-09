import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";
import { hashPassword, verifyPassword } from "./password";

describe("account authentication helpers", () => {
  it("normalizes Nigerian local phone numbers to E.164", () => {
    expect(normalizePhone("0806 567 8634")).toBe("+2348065678634");
  });

  it("accepts an already normalized international phone number", () => {
    expect(normalizePhone("+2348065678634")).toBe("+2348065678634");
  });

  it("rejects invalid phone numbers", () => {
    expect(() => normalizePhone("123")).toThrow();
  });

  it("hashes passwords without storing the raw password", async () => {
    const password = "a-private-password";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
