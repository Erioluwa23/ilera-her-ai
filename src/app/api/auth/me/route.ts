import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(sessionCookie.name)?.value,
  );
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.sub, phone: session.phone },
  });
}
