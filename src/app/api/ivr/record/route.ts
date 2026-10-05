import { randomUUID } from "node:crypto";
import { historyEnabled } from "@/lib/ivr-profiles";
import {
  configuration,
  DIGIT_LANGUAGE,
  failWebhook,
  prompt,
  readState,
  route,
  say,
  stateToken,
  signState,
  twiml,
  webhook,
} from "@/lib/ivr";
export async function POST(req: Request) {
  try {
    const form = await webhook(req);
    if (!configuration().configured)
      return twiml(say("Phone support is not available.") + "<Hangup/>");
    const url = new URL(req.url),
      phase = url.searchParams.get("phase");
    if (phase === "language") {
      const language = DIGIT_LANGUAGE[form.Digits];
      if (!language)
        return twiml(
          say("That choice was not recognised.") +
            `<Redirect method="POST">${route("incoming", undefined, { attempt: String(Math.min(3, Number(url.searchParams.get("attempt")) || 1)) })}</Redirect>`,
        );
      if (!configuration().languages.includes(language))
        return twiml(
          say("Audio support for that language is not ready yet.") +
            `<Redirect method="POST">${route("incoming", undefined, { attempt: String(Math.min(3, Number(url.searchParams.get("attempt")) || 1)) })}</Redirect>`,
        );
      const token = stateToken(form.CallSid, language);
      return twiml(
        `<Gather input="dtmf" numDigits="1" action="${route("record", token, { phase: "consent" })}" method="POST" timeout="8">${prompt(language, "consent", "Your question will be recorded and processed by our speech and health services. The recording is deleted after processing. Questions and answers are temporarily stored for up to twenty minutes to support this call. This is health information, not emergency care. Press 1 to agree and continue, or 2 to end the call.")}</Gather><Hangup/>`,
      );
    }
    const token = url.searchParams.get("state") || "",
      state = readState(token, form.CallSid);
    if (phase === "consent" && form.Digits !== "1")
      return twiml(prompt(state.language, "goodbye", "Goodbye.") + "<Hangup/>");
    if (phase !== "consent" && phase !== "retry")
      return twiml(say("Invalid call step.") + "<Hangup/>");
    if (phase === "retry" && !state.consented) return failWebhook();
    if (
      phase === "consent" &&
      historyEnabled(state.language) &&
      /^\+[1-9]\d{6,14}$/.test(form.From || "")
    ) {
      return twiml(
        `<Redirect method="POST">${route("profile", signState({ ...state, consented: true }))}</Redirect>`,
      );
    }
    // A retry gets a fresh job identifier; an old callback cannot replace a later answer.
    const next =
      phase === "retry"
        ? signState({
            ...state,
            id: randomUUID(),
            previous: state.id,
            callerKey: undefined,
            consented: true,
          })
        : signState({ ...state, consented: true });
    return twiml(
      `${prompt(state.language, "record", "After the beep, describe your menstrual health concern. Press hash when you finish. You have up to 45 seconds.")}<Record action="${route("wait", next)}" method="POST" recordingStatusCallback="${route("process", next)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed" maxLength="45" timeout="5" finishOnKey="#" playBeep="true" trim="trim-silence"/><Hangup/>`,
    );
  } catch {
    return failWebhook();
  }
}
