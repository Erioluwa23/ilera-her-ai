import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySessionToken } from "../session";
import { CycleError } from "./validation";

export function referenceDate(request: NextRequest) {
  const zone = request.headers.get("x-ileraher-timezone") || "Africa/Lagos";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    throw new CycleError("invalid_timezone");
  }
}
export async function bodyJSON(request: NextRequest, maxBytes = 32_768) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new CycleError("invalid_request", 415);
  if (!request.body) throw new CycleError("invalid_request");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new CycleError("request_too_large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new CycleError("invalid_request");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CycleError) throw error;
    throw new CycleError("invalid_request");
  }
}
export function cycleAPI(
  request: NextRequest,
  operation: (owner: string, today: string) => Promise<unknown>,
  successStatus = 200,
) {
  return (async () => {
    try {
      const session = await verifySessionToken(
        request.cookies.get(sessionCookie.name)?.value,
      );
      if (!session || !/^\d+$/.test(session.sub))
        throw new CycleError("sign_in_required", 401);
      const expectedOwner = request.headers.get("x-ileraher-account");
      if (expectedOwner && expectedOwner !== session.sub)
        throw new CycleError("account_changed", 409);
      if (request.method !== "GET") {
        const origin = request.headers.get("origin"),
          allowed = new Set([request.nextUrl.origin]);
        if (process.env.RENDER_EXTERNAL_URL)
          allowed.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
        if (
          !origin ||
          !allowed.has(origin) ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          throw new CycleError("invalid_origin", 403);
        if (request.headers.get("x-ileraher-account") !== session.sub)
          throw new CycleError("account_changed", 409);
      }
      return NextResponse.json(
        await operation(session.sub, referenceDate(request)),
        {
          status: successStatus,
          headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
        },
      );
    } catch (error) {
      const known = error instanceof CycleError;
      // Do not log database errors, request bodies, dates, phone numbers, or decrypted health records.
      if (!known) console.error("[cycles] request failed");
      return NextResponse.json(
        { error: known ? error.code : "cycle_service_unavailable" },
        {
          status: known ? error.status : 503,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
  })();
}
