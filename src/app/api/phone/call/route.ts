import type { NextRequest } from "next/server";
import { callFailure, signedInCaller } from "@/lib/app-call-http";
import { phoneJson, phoneResponse, startAppPhoneCall } from "@/lib/phone-pilot";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await signedInCaller(req), body = await phoneJson(req);
    return phoneResponse(await startAppPhoneCall(user.sub, body.language, body.consented));
  } catch (error) { return callFailure(error); }
}
