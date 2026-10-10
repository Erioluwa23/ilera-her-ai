import { NextRequest } from "next/server";
import { sessionCookie, verifySessionToken } from "@/lib/session";
import { changePhoneAccount, phoneAccount, phoneFailure, phoneJson, phoneResponse, PhoneError, requireSameOrigin } from "@/lib/phone-pilot";

export const runtime = "nodejs";
async function signedIn(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(sessionCookie.name)?.value);
  if (!session) throw new PhoneError(401, "Please sign in first.");
  return session;
}
export async function GET(req: NextRequest) {
  try { const user = await signedIn(req); return phoneResponse({ phone: user.phone, ...await phoneAccount(user.sub) }); }
  catch (e) { return phoneFailure(e); }
}
async function update(req: NextRequest, remove: boolean) {
  try {
    requireSameOrigin(req);
    const user = await signedIn(req);
    await changePhoneAccount(user.sub, await phoneJson(req), remove);
    return phoneResponse({ ok: true });
  } catch (e) { return phoneFailure(e); }
}
export async function POST(req: NextRequest) { return update(req, false); }
export async function DELETE(req: NextRequest) { return update(req, true); }
