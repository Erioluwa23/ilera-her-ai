import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySessionToken } from "@/lib/session";
import { safeReturn } from "@/lib/return-route";

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/help" ||
    request.nextUrl.pathname === "/sw.js" ||
    request.nextUrl.pathname === "/manifest.webmanifest" ||
    request.nextUrl.pathname === "/offline" ||
    request.nextUrl.pathname === "/offline.html"
  )
    return NextResponse.next();
  const session = await verifySessionToken(
    request.cookies.get(sessionCookie.name)?.value,
  );
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    safeReturn(request.nextUrl.pathname + request.nextUrl.search),
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|v1|login|signup|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
