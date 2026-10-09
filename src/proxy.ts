import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(sessionCookie.name)?.value,
  );
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|v1|login|signup|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
