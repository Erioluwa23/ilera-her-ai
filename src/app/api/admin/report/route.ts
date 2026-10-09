import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { ensureAuthSchema, getDb } from "@/lib/db";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(sessionCookie.name)?.value,
  );
  return isAdminSession(session);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    await ensureAuthSchema();
    const db = getDb();
    const [users, feedback, categories, recent] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7_days,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last_30_days
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          ROUND(COALESCE(AVG(rating),0)::numeric, 2) AS average_rating,
          COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7_days
        FROM feedback
      `),
      db.query(`
        SELECT category, COUNT(*)::int AS count
        FROM feedback
        GROUP BY category
        ORDER BY count DESC, category ASC
      `),
      db.query(`
        SELECT
          f.id,
          f.rating,
          f.category,
          f.message,
          f.status,
          f.created_at,
          RIGHT(u.phone_e164, 4) AS phone_tail
        FROM feedback f
        JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC
        LIMIT 100
      `),
    ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      users: users.rows[0],
      feedback: feedback.rows[0],
      categories: categories.rows,
      recent: recent.rows,
    });
  } catch (error) {
    console.error("[admin report] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Report is temporarily unavailable." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const body = await request.json();
    const id = Number(body?.id);
    const status = String(body?.status || "");
    if (!Number.isInteger(id) || !["new", "reviewed", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid feedback update." }, { status: 400 });
    }

    await ensureAuthSchema();
    const result = await getDb().query(
      "UPDATE feedback SET status=$2, updated_at=now() WHERE id=$1 RETURNING id, status",
      [id, status],
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("[admin report update] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Feedback could not be updated." }, { status: 500 });
  }
}
