import { NatlasSpeechProvider } from "@/lib/natlas";
import { AsrError } from "@/lib/asr-contract";
import { voiceAnswer } from "@/lib/voice-answer";
import { replyAudio } from "@/lib/reply-audio";
import { validatePhoneWav } from "@/lib/phone-audio";
import type { ConversationTurn } from "@/lib/voice-chat";
import { beginPhoneTurn, finishPhoneTurn, getPhoneSession, MAX_CALL_AUDIO_BYTES, openPhone, phoneFailure, phoneResponse, PhoneError, readPhoneBody, releasePhoneTurn, requirePhoneIntegration, validCallId, type PhoneSession } from "@/lib/phone-pilot";

export const runtime = "nodejs";
export async function POST(req: Request) {
  let session: PhoneSession | undefined, turnId: string | undefined, claimed = false;
  try {
    requirePhoneIntegration(req);
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new PhoneError(400, "Upload a phone recording.");
    const bytes = await readPhoneBody(req, MAX_CALL_AUDIO_BYTES + 8192);
    const data = await new Request(req.url, { method: "POST", headers: req.headers, body: new Uint8Array(bytes) }).formData();
    const id = data.get("turnId");
    if (!validCallId(id)) throw new PhoneError(400, "Invalid turn identifier.");
    turnId = id;
    session = await getPhoneSession(data.get("callId"), data.get("grant"));
    const audio = data.get("audio");
    if (!(audio instanceof Blob)) throw new PhoneError(400, "Phone recording is required.");
    const buffer = Buffer.from(await audio.arrayBuffer());
    validatePhoneWav(buffer);
    await beginPhoneTurn(session, turnId); claimed = true;
    const transcript = await new NatlasSpeechProvider().transcribe(new Blob([new Uint8Array(buffer)], { type: "audio/wav" }), session.language,
      AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]));
    const context = session.context_enc ? openPhone<ConversationTurn[]>(session.context_enc) : [];
    const result = await voiceAnswer(transcript.text.slice(0, 1200), session.language, context,
      AbortSignal.any([req.signal, AbortSignal.timeout(12_000)]));
    // The phone response contains verified source/model metadata, never raw upstream errors.
    const { natlasError: _upstreamError, ...answer } = result;
    const spokenText = [answer.answer, ...answer.nextSteps.slice(0, 2), answer.disclaimer].join(" ");
    const speech = await replyAudio(spokenText, session.language, AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]));
    await finishPhoneTurn(session, turnId, transcript.text, answer);
    return phoneResponse({ turnId, ...answer, spokenText, transcriptionModel: transcript.model,
      speechModel: speech.model, audio: speech.audio.toString("base64"), contentType: speech.contentType });
  } catch (e) {
    if (e instanceof AsrError) return phoneResponse({ error: e.message, code: e.code }, e.status);
    return phoneFailure(e);
  } finally {
    if (session && turnId && claimed) {
      try { await releasePhoneTurn(session, turnId); } catch { /* Lease expires without exposing health data. */ }
    }
  }
}
