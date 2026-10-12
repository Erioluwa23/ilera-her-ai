import twilio from "twilio";
import { NatlasSpeechProvider, NatlasLLMProvider } from "./natlas";
import { answerQuestion, evidenceFor, localizeHealthAnswer } from "./knowledge";
import { callerHistory } from "./ivr-profiles";
import { claim, finish, getJob, type JobResult } from "./ivr-jobs";
import type { CallState } from "./ivr";
import { replyAudio } from "./reply-audio";
import { YARN_TTS_MODEL } from "./yarn-audio";
async function boundedAudio(response: Response, max: number) {
  if (!response.ok || !response.body) throw new Error("Audio unavailable");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new Error("Audio too large");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function runJob(state: CallState) {
  const lease = await claim(state);
  if (!lease) return;
  const sid = process.env.TWILIO_ACCOUNT_SID!,
    token = process.env.TWILIO_AUTH_TOKEN!;
  try {
    if (!/^RE[a-f0-9]{32}$/i.test(lease.recording))
      throw new Error("Invalid recording");
    // Construct the provider URL from verified identifiers; never fetch a webhook-supplied URL.
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${lease.recording}.wav`,
      {
        headers: {
          Authorization:
            "Basic " + Buffer.from(sid + ":" + token).toString("base64"),
        },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    const audio = await boundedAudio(response, 5 * 1024 * 1024);
    const transcript = await new NatlasSpeechProvider().transcribe(
      new Blob([new Uint8Array(audio)], { type: "audio/wav" }),
      state.language,
      AbortSignal.timeout(90000),
    );
    const history = await callerHistory(state);
    const previous = state.previous
      ? await getJob({ ...state, id: state.previous })
      : null;
    const reported =
      previous?.result?.reported ||
      (previous?.result?.question ? [previous.result.question] : []);
    const conversation = reported.map((content) => ({ role: "user", content }));
    const current = answerQuestion(transcript.text, state.language);
    const candidates = reported.map((text) =>
      answerQuestion(text, state.language),
    );
    const combined = reported.map((text) =>
      answerQuestion(text + "\n" + transcript.text, state.language),
    );
    const grounded =
      [...candidates, ...combined, current].find(
        (answer) => answer.urgency === "urgent",
      ) ||
      (current.topic !== "unknown"
        ? current
        : [...candidates]
            .reverse()
            .find((answer) => answer.topic !== "unknown") || current);
    const localized = localizeHealthAnswer(grounded, state.language);
    // Urgent care instructions stay source-grounded; generation cannot downgrade urgency.
    let generated = null;
    try {
      generated =
        grounded.urgency === "urgent"
          ? null
          : await new NatlasLLMProvider().answer(
                transcript.text,
                {
                  ...evidenceFor(grounded),
                  conversation,
                  callerHistory: history,
                  relatedEvidence: history.map((turn) =>
                    evidenceFor(answerQuestion(turn.question, state.language)),
                  ),
                },
                state.language,
                AbortSignal.timeout(15000),
              );
    } catch {
      /* Preserve reviewed guidance when generation is unavailable. */
    }
    const text =
      (generated?.text ||
        [localized.answer, ...localized.nextSteps].join(" ")) +
      " " +
      localized.disclaimer;
    // Every language, including English, uses the same verified YarnGPT runtime
    // as web voice replies. No provider Say or alternate TTS endpoint is used.
    const speech = await replyAudio(text, state.language, AbortSignal.timeout(90000));
    if (speech.model !== YARN_TTS_MODEL || speech.contentType !== "audio/wav" ||
        speech.audio.length < 44 || speech.audio.length > 4 * 1024 * 1024 ||
        speech.audio.toString("ascii", 0, 4) !== "RIFF" ||
        speech.audio.toString("ascii", 8, 12) !== "WAVE")
      throw new Error("Verified telephone speech is unavailable");
    const result: JobResult = {
      text,
      question: transcript.text,
      reported: [...reported, transcript.text].slice(-4),
      audio: speech.audio.toString("base64"),
      contentType: speech.contentType,
      speechModel: speech.model,
      language: state.language,
    };
    await finish(state, lease.lease, result);
  } catch {
    await finish(state, lease.lease, null);
  } finally {
    // Health recordings are removed from the provider after processing. No audio/transcript is logged.
    try {
      await twilio(sid, token).recordings(lease.recording).remove();
    } catch {
      console.warn("IVR provider recording cleanup failed");
    }
  }
}
