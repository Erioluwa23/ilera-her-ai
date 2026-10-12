import { callFailure } from "@/lib/app-call-http";
import { validatePhoneWav } from "@/lib/phone-audio";
import { answerPhoneTurn } from "@/lib/phone-turn";
import { getPhoneSession, MAX_CALL_AUDIO_BYTES, phoneResponse, PhoneError, readPhoneBody, requirePhoneIntegration, validCallId } from "@/lib/phone-pilot";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    requirePhoneIntegration(req);
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new PhoneError(400, "Upload a phone recording.");
    const bytes = await readPhoneBody(req, MAX_CALL_AUDIO_BYTES + 8192);
    const data = await new Request(req.url, { method: "POST", headers: req.headers, body: new Uint8Array(bytes) }).formData();
    const turnId = data.get("turnId");
    if (!validCallId(turnId)) throw new PhoneError(400, "Invalid turn identifier.");
    const session = await getPhoneSession(data.get("callId"), data.get("grant"));
    const audio = data.get("audio");
    if (!(audio instanceof Blob)) throw new PhoneError(400, "Phone recording is required.");
    const buffer = Buffer.from(await audio.arrayBuffer());
    validatePhoneWav(buffer);
    return phoneResponse(await answerPhoneTurn(session, turnId, buffer, req.signal));
  } catch (error) { return callFailure(error, 503); }
}
