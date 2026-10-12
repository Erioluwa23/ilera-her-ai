import type { NextRequest } from "next/server";
import { sessionCookie, verifySessionToken } from "./session";
import { AsrError } from "./asr-contract";
import { phoneFailure, phoneResponse, PhoneError, requireSameOrigin } from "./phone-pilot";
import { PhoneSpeechError } from "./phone-turn";
import { quotaResponse } from "./quota-retry";

export const APP_CALL_AUDIO_BYTES = 1_000_000;
export async function signedInCaller(req: NextRequest) {
  requireSameOrigin(req);
  const user = await verifySessionToken(req.cookies.get(sessionCookie.name)?.value);
  if (!user) throw new PhoneError(401, "Please sign in first.");
  return user;
}
export async function callFailure(error: unknown, speechUnavailableStatus = 502) {
  if (error instanceof PhoneSpeechError) {
    if (error.quota) {
      const response = quotaResponse("TTS_QUOTA", error.retryAt);
      return phoneResponse({ ...await response.json(), reply: error.reply }, 429, response.headers);
    }
    return phoneResponse({ error: "Audio is unavailable. Read the reply or try again later.", code: "TTS_UNAVAILABLE", reply: error.reply }, speechUnavailableStatus);
  }
  if (error instanceof AsrError) {
    if (error.code === "ASR_QUOTA") return quotaResponse(error.code, error.retryAt);
    return phoneResponse({ error: error.message, code: error.code }, error.status);
  }
  return phoneFailure(error);
}
