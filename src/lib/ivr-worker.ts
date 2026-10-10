import twilio from "twilio";
import { NatlasSpeechProvider, NatlasLLMProvider } from "./natlas";
import { answerQuestion, evidenceFor, localizeHealthAnswer } from "./knowledge";
import { callerHistory } from "./ivr-profiles";
import { claim, finish, getJob, type JobResult } from "./ivr-jobs";
import type { CallState } from "./ivr";
import { explainAnswer } from "./ai/answer";
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
    let explanation: Awaited<ReturnType<typeof explainAnswer>> | null = null;
    try {
      if (process.env.AI_PROVIDER_MODE !== "natlas") {
        explanation = await explainAnswer(
          transcript.text,
          state.language,
          conversation as { role: "user"; content: string }[],
          process.env.IVR_EXTERNAL_AI_ENABLED === "true",
          AbortSignal.timeout(25000),
        );
      } else
        generated =
          grounded.urgency === "urgent"
            ? null
            : await timed(
                new NatlasLLMProvider().answer(
                  transcript.text,
                  {
                    ...evidenceFor(grounded),
                    conversation,
                    callerHistory: history,
                    relatedEvidence: history.map((turn) =>
                      evidenceFor(
                        answerQuestion(turn.question, state.language),
                      ),
                    ),
                  },
                  state.language,
                ),
              );
    } catch {
      /* Preserve reviewed guidance when generation is unavailable. */
    }
    const text =
      (explanation
        ? [explanation.answer, ...explanation.nextSteps].join(" ")
        : generated?.text ||
          [localized.answer, ...localized.nextSteps].join(" ")) +
      " " +
      (explanation?.disclaimer || localized.disclaimer);
    const result: JobResult = {
      text,
      question: transcript.text,
      reported: [...reported, transcript.text].slice(-4),
    };
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
