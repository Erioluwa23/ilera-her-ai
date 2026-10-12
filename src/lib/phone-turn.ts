import { NatlasSpeechProvider } from "./natlas";
import { AsrError } from "./asr-contract";
import { voiceAnswer } from "./voice-answer";
import { replyAudio } from "./reply-audio";
import type { ConversationTurn } from "./voice-chat";
import { beginPhoneTurn, finishPhoneTurn, MAX_CALL_TURNS, openPhone, releasePhoneTurn, type PhoneSession } from "./phone-pilot";

export type CallAnswer = Omit<Awaited<ReturnType<typeof voiceAnswer>>, "natlasError">;
export class PhoneSpeechError extends Error {
  constructor(public readonly reply: CallAnswer & { question: string }, public readonly quota: boolean, public readonly retryAt?: string) {
    super("The spoken reply is unavailable.");
  }
}

// Both calling transports share N-ATLaS transcription, source-grounded health
// guidance and verified YarnGPT audio. Raw recordings never enter the database.
export async function answerPhoneTurn(session: PhoneSession, turnId: string, audio: Buffer, signal: AbortSignal) {
  await beginPhoneTurn(session, turnId);
  try {
    const inApp = session.channel === "app";
    const transcript = await new NatlasSpeechProvider().transcribe(
      new Blob([new Uint8Array(audio)], { type: "audio/wav" }), session.language,
      AbortSignal.any([signal, AbortSignal.timeout(inApp ? 90_000 : 45_000)]),
    );
    if (signal.aborted) throw new AsrError("ASR_CANCELLED", 499, "Call ended.");
    const context = session.context_enc ? openPhone<ConversationTurn[]>(session.context_enc) : [];
    const result = await voiceAnswer(transcript.text.slice(0, 1200), session.language, context,
      AbortSignal.any([signal, AbortSignal.timeout(inApp ? 25_000 : 12_000)]));
    const { natlasError: _upstreamError, ...answer } = result;
    const spokenText = [answer.answer, ...answer.nextSteps.slice(0, 2), answer.disclaimer].join(" ");
    let speech;
    try {
      speech = await replyAudio(spokenText, session.language, AbortSignal.any([signal, AbortSignal.timeout(inApp ? 90_000 : 45_000)]));
    } catch (error) {
      throw new PhoneSpeechError({ question: transcript.text, ...answer }, error instanceof AsrError && error.code === "ASR_QUOTA", error instanceof AsrError ? error.retryAt : undefined);
    }
    if (signal.aborted) throw new AsrError("ASR_CANCELLED", 499, "Call ended.");
    await finishPhoneTurn(session, turnId, transcript.text, answer);
    return { turnId, question: transcript.text, ...answer, spokenText,
      transcriptionModel: transcript.model, speechModel: speech.model,
      audio: speech.audio.toString("base64"), contentType: speech.contentType,
      turnsRemaining: Math.max(0, MAX_CALL_TURNS - session.turns - 1) };
  } finally {
    try { await releasePhoneTurn(session, turnId); } catch { /* The lease expires without logging health data. */ }
  }
}
