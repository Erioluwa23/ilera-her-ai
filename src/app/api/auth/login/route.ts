import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = normalizePhone(String(body?.phone ?? ""));
    const password = String(body?.password ?? "");

    await ensureAuthSchema();
    const result = await getDb().query(
      "SELECT id, phone_e164, password_hash FROM users WHERE phone_e164 = $1 LIMIT 1",
      [phone],
    );
    const user = result.rows[0];
    const valid = user
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect phone number or password." },
        { status: 401 },
      );
    }

    const token = await createSessionToken(String(user.id), user.phone_e164);
    const response = NextResponse.json({
      user: { id: String(user.id), phone: user.phone_e164 },
    });
    response.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return response;
  } catch (error) {
    console.error("[auth login] request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "Sign in is temporarily unavailable." },
      { status: 500 },
    );
  }
}
