import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";
const script = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
function worker(response: Response) {
  const handlers: Record<string, (event: any) => void> = {},
    put = vi.fn(),
    fetch = vi.fn().mockResolvedValue(response),
    caches = {
      open: vi.fn().mockResolvedValue({ put }),
      match: vi.fn().mockResolvedValue(undefined),
    };
  runInNewContext(script, {
    self: {
      location: { origin: "https://app" },
      addEventListener: (name: string, fn: (event: any) => void) =>
        (handlers[name] = fn),
      skipWaiting: vi.fn(),
    },
    fetch,
    caches,
    URL,
    Response,
    Set,
  });
  return { handler: handlers.fetch, put, fetch };
}
async function request(path: string, response: Response, mode = "navigate") {
  const w = worker(response),
    waits: Promise<unknown>[] = [];
  let result: Promise<Response> | undefined;
  w.handler({
    request: { url: "https://app" + path, method: "GET", mode },
    respondWith: (p: Promise<Response>) => (result = p),
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  if (result) await result;
  await Promise.all(waits);
  return w;
}
describe("offline shell privacy", () => {
  it("caches an account-neutral visited shell without caching server health data", async () => {
    const w = await request(
      "/voice",
      new Response("<html>Loading browser records</html>", {
        headers: {
          "cache-control": "private, no-store",
          "content-type": "text/html",
        },
      }),
    );
    expect(w.put).toHaveBeenCalledTimes(1);
  });
  it.each([
    "/api/ask",
    "/api/auth/me",
    "/v1/audio/transcriptions",
    "/login",
    "/signup",
  ])(
    "never intercepts sensitive or authenticated responses from %s",
    async (path) => {
      const w = await request(path, new Response("private"));
      expect(w.fetch).not.toHaveBeenCalled();
      expect(w.put).not.toHaveBeenCalled();
    },
  );
  it("never caches the admin or another non-shell page even when no cache header was provided", async () => {
    expect(
      (
        await request(
          "/admin",
          new Response("private admin data", {
            headers: { "content-type": "text/html" },
          }),
        )
      ).put,
    ).not.toHaveBeenCalled();
  });
  it("does not cache an authentication redirect as an offline app", async () => {
    const response = new Response("Sign in", {
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "redirected", { value: true });
    expect((await request("/voice", response)).put).not.toHaveBeenCalled();
  });
});
