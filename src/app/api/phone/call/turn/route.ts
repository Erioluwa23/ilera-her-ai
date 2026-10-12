import type { NextRequest } from "next/server";
import { APP_CALL_AUDIO_BYTES, callFailure, signedInCaller } from "@/lib/app-call-http";
import { getAppPhoneSession, phoneResponse, PhoneError, readPhoneBody, validCallId } from "@/lib/phone-pilot";
import { validatePhoneWav } from "@/lib/phone-audio";
import { answerPhoneTurn } from "@/lib/phone-turn";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await signedInCaller(req);
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new PhoneError(400, "Upload a call recording.");
    const bytes = await readPhoneBody(req, APP_CALL_AUDIO_BYTES + 8192);
    const data = await new Request(req.url, { method: "POST", headers: req.headers, body: new Uint8Array(bytes) }).formData();
    const turnId = data.get("turnId");
    if (!validCallId(turnId)) throw new PhoneError(400, "Invalid turn identifier.");
    const session = await getAppPhoneSession(user.sub, data.get("callId"), data.get("grant"));
    const audio = data.get("audio");
    if (!(audio instanceof Blob)) throw new PhoneError(400, "Call recording is required.");
    const buffer = Buffer.from(await audio.arrayBuffer());
    validatePhoneWav(buffer, APP_CALL_AUDIO_BYTES);
    return phoneResponse(await answerPhoneTurn(session, turnId, buffer, req.signal));
  } catch (error) { return callFailure(error); }
}
