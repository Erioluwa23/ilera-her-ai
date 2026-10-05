import twilio from "twilio";
import { NatlasSpeechProvider, NatlasLLMProvider } from "./natlas";
import { answerQuestion, evidenceFor, localizeHealthAnswer } from "./knowledge";
import { claim, finish, type JobResult } from "./ivr-jobs";
import type { CallState } from "./ivr";
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
async function timed<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Generation timeout")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
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
    const grounded = answerQuestion(transcript.text, state.language),
      localized = localizeHealthAnswer(grounded, state.language);
    // Urgent care instructions stay source-grounded; generation cannot downgrade urgency.
    const generated =
      grounded.urgency === "urgent"
        ? null
        : await timed(
            new NatlasLLMProvider().answer(
              transcript.text,
              evidenceFor(grounded),
              state.language,
            ),
          );
    const text =
      (generated?.text || localized.answer) + " " + localized.disclaimer;
    const result: JobResult = { text };
    if (state.language !== "en-NG") {
      const url = new URL(process.env.IVR_TTS_API_URL || "");
      if (url.protocol !== "https:") throw new Error("TTS not configured");
      const tts = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.IVR_TTS_API_KEY
            ? { Authorization: "Bearer " + process.env.IVR_TTS_API_KEY }
            : {}),
        },
        body: JSON.stringify({ text, language: state.language }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      const type = (tts.headers.get("content-type") || "").split(";")[0];
      if (!["audio/mpeg", "audio/wav", "audio/x-wav"].includes(type))
        throw new Error("Invalid speech audio");
      result.audio = (await boundedAudio(tts, 4 * 1024 * 1024)).toString(
        "base64",
      );
      result.contentType = type;
    }
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
