import { timingSafeEqual } from "node:crypto";
import { database, schema } from "@/lib/ivr-jobs";
export async function POST(req: Request) {
  const secret = process.env.IVR_MAINTENANCE_SECRET || "",
    supplied = req.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  if (
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response("Forbidden", { status: 403 });
  try {
    await schema();
    await database().query(
      "DELETE FROM ileraher_ivr_profiles WHERE expires_at<now(); DELETE FROM ileraher_ivr_history WHERE created_at<now()-interval '30 days'; DELETE FROM ileraher_ivr_jobs WHERE expires_at<now()",
    );
    return Response.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
