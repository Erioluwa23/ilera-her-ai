import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, getDb } from "@/lib/db";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

const CATEGORIES = new Set([
  "general",
  "voice",
  "cycle",
  "language",
  "low-data",
  "bug",
  "suggestion",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await verifySessionToken(
      request.cookies.get(sessionCookie.name)?.value,
    );
    if (!session) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const rating = Number(body?.rating);
    const category = String(body?.category || "general");
    const message = String(body?.message || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Choose a rating from 1 to 5." },
        { status: 400 },
      );
    }
    if (!CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "Choose a valid feedback category." },
        { status: 400 },
      );
    }
    if ((message.length > 0 && message.length < 3) || message.length > 2000) {
      return NextResponse.json(
        {
          error:
            "Leave the comment empty or use between 3 and 2000 characters.",
        },
        { status: 400 },
      );
    }

    await ensureAuthSchema();
    await getDb().query(
      `INSERT INTO feedback (user_id, rating, category, message)
       VALUES ($1, $2, $3, $4)`,
      [session.sub, rating, category, message],
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(
      "[feedback] submission failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Feedback could not be saved right now." },
      { status: 500 },
    );
  }
}
