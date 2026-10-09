import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { createSessionToken, sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = normalizePhone(String(body?.phone ?? ""));
    const password = String(body?.password ?? "");

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "Password must be between 8 and 128 characters." },
        { status: 400 },
      );
    }

    await ensureAuthSchema();
    const db = getDb();
    const existing = await db.query(
      "SELECT id FROM users WHERE phone_e164 = $1 LIMIT 1",
      [phone],
    );
    if (existing.rowCount) {
      return NextResponse.json(
        { error: "An account already exists for this phone number." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const created = await db.query(
      "INSERT INTO users (phone_e164, password_hash) VALUES ($1, $2) RETURNING id, phone_e164",
      [phone, passwordHash],
    );
    const user = created.rows[0];
    const token = await createSessionToken(String(user.id), user.phone_e164);

    const response = NextResponse.json(
      { user: { id: String(user.id), phone: user.phone_e164 } },
      { status: 201 },
    );
    response.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return response;
  } catch (error) {
    console.error("[auth signup] request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable." },
      { status: 500 },
    );
  }
}
