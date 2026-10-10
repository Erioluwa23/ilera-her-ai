import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({}),
  verify: vi.fn().mockResolvedValue({ sub: "test-user" }),
}));
vi.mock("@/lib/db", () => ({
  ensureAuthSchema: vi.fn(),
  getDb: () => ({ query: mocks.query }),
}));
vi.mock("@/lib/session", () => ({
  sessionCookie: { name: "ileraher_session" },
  verifySessionToken: mocks.verify,
}));
import { POST } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://app/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
describe("feedback acknowledgement", () => {
  afterEach(() => vi.clearAllMocks());
  it("accepts a deliberately selected rating with no optional comment", async () => {
    expect(
      (await POST(request({ rating: 2, message: "", category: "general" })))
        .status,
    ).toBe(201);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "test-user",
      2,
      "general",
      "",
    ]);
  });
  it.each([
    { rating: undefined },
    { rating: 0 },
    { rating: 6 },
    { rating: 3, message: "hi" },
    { rating: 3, message: "x".repeat(2001) },
    { rating: 3, category: "unknown" },
  ])("rejects invalid input %j without storing it", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("never acknowledges an unsuccessful database write", async () => {
    mocks.query.mockRejectedValueOnce(new Error("test write failure"));
    expect((await POST(request({ rating: 3 }))).status).toBe(500);
  });
  it("requires authentication", async () => {
    mocks.verify.mockResolvedValueOnce(null);
    expect((await POST(request({ rating: 3 }))).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
