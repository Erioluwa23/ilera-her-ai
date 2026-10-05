import { after } from "next/server";
import { getJob } from "@/lib/ivr-jobs";
import { runJob } from "@/lib/ivr-worker";
import {
  failWebhook,
  prompt,
  readState,
  route,
  say,
  twiml,
  webhook,
} from "@/lib/ivr";
export async function POST(req: Request) {
  let form: Record<string, string>;
  try {
    form = await webhook(req);
  } catch {
    return failWebhook();
  }
  try {
    const url = new URL(req.url),
      token = url.searchParams.get("state") || "",
      state = readState(token, form.CallSid),
      round = Math.min(
        32,
        Math.max(0, Number(url.searchParams.get("round")) || 0),
      );
    if (!state.consented) return failWebhook();
    if (form.Digits === "2")
      return twiml(
        `<Redirect method="POST">${route("record", token, { phase: "retry" })}</Redirect>`,
      );
    if (form.Digits === "9")
      return twiml(`<Redirect method="POST">${route("incoming")}</Redirect>`);
    if (form.Digits === "3")
      return twiml(prompt(state.language, "goodbye", "Goodbye.") + "<Hangup/>");
    const job = await getJob(state);
    if (job?.status === "ready" && job.result) {
      const audio = job.result.audio
        ? `<Play>${route("media", token)}</Play>`
        : say(job.result.text);
      return twiml(
        audio +
          `<Gather input="dtmf" numDigits="1" action="${route("wait", token)}" method="POST" timeout="8">${prompt(state.language, "menu", "Press 1 to hear the response again. Press 2 to ask another question. Press 9 to change language. Press 3 to end the call.")}</Gather><Hangup/>`,
      );
    }
    if (job?.status === "failed" || round >= 32)
      return twiml(
        `<Gather input="dtmf" numDigits="1" action="${route("wait", token)}" method="POST" timeout="8">${prompt(state.language, "error", "We could not prepare your response. If symptoms are severe or worrying, seek medical care. Press 2 to try again, 9 to change language, or 3 to end the call.")}</Gather><Hangup/>`,
      );
    if (job)
      after(async () => {
        try {
          await runJob(state);
        } catch {
          console.warn("IVR job recovery failed");
        }
      });
    return twiml(
      (round === 0
        ? prompt(
            state.language,
            "waiting",
            "Please wait while we prepare your guidance.",
          )
        : "") +
        `<Pause length="5"/><Redirect method="POST">${route("wait", token, { round: String(round + 1) })}</Redirect>`,
    );
  } catch {
    return twiml(
      say(
        "We could not continue this call. Please try later. Seek medical care for worrying symptoms.",
      ) + "<Hangup/>",
    );
  }
}
