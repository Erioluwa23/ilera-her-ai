import type { NextRequest } from "next/server";
import { callFailure, signedInCaller } from "@/lib/app-call-http";
import { getAppPhoneSession, phoneEvent, phoneJson, phoneResponse, PhoneError } from "@/lib/phone-pilot";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await signedInCaller(req), body = await phoneJson(req);
    if (!["played", "feedback", "end"].includes(String(body.event))) throw new PhoneError(400, "Invalid call event.");
    await getAppPhoneSession(user.sub, body.callId, body.grant);
    return phoneResponse(await phoneEvent(body));
  } catch (error) { return callFailure(error); }
}
