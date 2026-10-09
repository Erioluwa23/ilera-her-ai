import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(sessionCookie.name)?.value,
  );
  if (!session) {
    return NextResponse.json({ user: null, isAdmin: false }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.sub, phone: session.phone },
    isAdmin: isAdminSession(session),
  });
}
