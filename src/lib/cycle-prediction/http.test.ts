import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  verify: vi.fn().mockResolvedValue({ sub: "1" }),
  read: vi.fn().mockResolvedValue({ logs: [] }),
  save: vi.fn().mockResolvedValue({ userId: "1" }),
  edit: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue({}),
  preferences: vi.fn().mockResolvedValue({}),
  clear: vi.fn().mockResolvedValue({}),
  import: vi.fn().mockResolvedValue({}),
}));
vi.mock("../session", () => ({
  sessionCookie: { name: "ileraher_session" },
  verifySessionToken: mocks.verify,
}));
vi.mock("./store", () => ({
  readCycleState: mocks.read,
  savePeriod: mocks.save,
  deletePeriod: mocks.remove,
  saveCyclePreferences: mocks.preferences,
  deleteCycleData: mocks.clear,
  importPeriods: mocks.import,
}));
import { GET, DELETE } from "@/app/api/v1/cycles/history/route";
import { POST } from "@/app/api/v1/periods/route";
import { PATCH } from "@/app/api/v1/periods/[id]/route";
import { bodyJSON } from "./http";
const request = (
  method = "POST",
  body: unknown = { period: { id: "p1" } },
  headers: Record<string, string> = {},
) =>
  new NextRequest("https://app.test/api/v1/periods", {
    method,
    headers: {
      origin: "https://app.test",
      "x-ileraher-account": "1",
      "content-type": "application/json",
      ...headers,
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("authenticated cycle APIs", () => {
  it.each(["GET", "POST", "DELETE"])(
    "rejects unauthenticated %s without touching the store",
    async (method) => {
      mocks.verify.mockResolvedValueOnce(null);
      const handler =
        method === "GET" ? GET : method === "POST" ? POST : DELETE;
      expect((await handler(request(method))).status).toBe(401);
      expect(mocks.read).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.clear).not.toHaveBeenCalled();
    },
  );
  it("uses verified identity, ignoring any client supplied user ID", async () => {
    const response = await POST(
      request("POST", { user_id: "2", period: { id: "p1", user_id: "2" } }),
    );
    expect(response.status).toBe(201);
    expect(mocks.save.mock.calls[0][0]).toBe("1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects cross-origin changes", async () => {
    expect(
      (await POST(request("POST", {}, { origin: "https://evil.test" }))).status,
    ).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects an old tab belonging to another account", async () => {
    expect(
      (await POST(request("POST", {}, { "x-ileraher-account": "2" }))).status,
    ).toBe(409);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("passes version checks and route IDs to an owner-scoped edit", async () => {
    await PATCH(request("PATCH", { period: { id: "p1" }, version: 3 }), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(mocks.save).toHaveBeenCalledWith(
      "1",
      { id: "p1" },
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "p1",
      3,
    );
  });
  it("does not expose internal errors or private payloads", async () => {
    mocks.read.mockRejectedValueOnce(
      new Error("SECRET medical/database details"),
    );
    const response = await GET(request("GET"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET");
  });
  it("rejects malformed JSON objects", async () => {
    expect((await POST(request("POST", null))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("bounds the request body before the store can be called", async () => {
    expect(
      (await POST(request("POST", { period: { notes: "x".repeat(40_000) } })))
        .status,
    ).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("requires JSON content type", async () => {
    await expect(
      bodyJSON(request("POST", {}, { "content-type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
  });
});
