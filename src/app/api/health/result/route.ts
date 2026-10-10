import { requestSession } from "@/lib/request-session";
import { boundedJson, BodyTooLarge } from "@/lib/bounded-json";
import { serverResult } from "@/lib/health/server-result";
export async function POST(req: Request) {
  const headers = { "cache-control": "private, no-store" };
  if (!(await requestSession(req)))
    return Response.json(
      { error: "Please sign in first." },
      { status: 401, headers },
    );
  try {
    return Response.json(serverResult(await boundedJson(req, 50000)), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof BodyTooLarge
            ? "Request too large."
            : "Check the selected confirmed records.",
      },
      { status: error instanceof BodyTooLarge ? 413 : 400, headers },
    );
  }
}
