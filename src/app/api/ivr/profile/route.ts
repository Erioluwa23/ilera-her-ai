import {
  failWebhook,
  prompt,
  readState,
  route,
  signState,
  twiml,
  webhook,
} from "@/lib/ivr";
import {
  callerKey,
  forgetProfile,
  historyEnabled,
  profileExists,
  unlockProfile,
} from "@/lib/ivr-profiles";
export async function POST(req: Request) {
  try {
    const form = await webhook(req),
      url = new URL(req.url),
      phase = url.searchParams.get("phase") || "start";
    const state = readState(url.searchParams.get("state") || "", form.CallSid);
    if (!state.consented) return failWebhook();
    const next = () =>
      twiml(
        `<Redirect method="POST">${route("record", signState(state), { phase: "retry" })}</Redirect>`,
      );
    if (phase === "delete") {
      if (!state.profileId) return failWebhook();
      if (form.Digits === "1") {
        await forgetProfile(state);
        return twiml(
          prompt(
            state.language,
            "history-deleted",
            "Your saved history and PIN have been deleted. Goodbye.",
          ) + "<Hangup/>",
        );
      }
      return next();
    }
    if (phase === "manage") {
      if (!state.profileId) return failWebhook();
      return twiml(
        `<Gather input="dtmf" numDigits="1" action="${route("profile", signState(state), { phase: "delete" })}" method="POST" timeout="8">${prompt(state.language, "history-delete", "Press 1 to permanently delete your saved history and PIN, or 2 to continue.")}</Gather><Hangup/>`,
      );
    }
    if (!historyEnabled(state.language)) return next();
    const hash = callerKey(form.From || "");
    if (!hash) return next();
    if (phase === "start") {
      state.callerKey = hash;
      return twiml(
        `<Gather input="dtmf" numDigits="1" action="${route("profile", signState(state), { phase: "choice" })}" method="POST" timeout="8">${prompt(state.language, "history-choice", "We can remember your questions and advice for 30 days, linked privately to this phone number and protected by a six digit PIN. Only choose this on a phone you control. Press 1 to use saved history, or 2 for a private call without saved history.")}</Gather><Redirect method="POST">${route("record", signState({ ...state, callerKey: undefined }), { phase: "retry" })}</Redirect>`,
      );
    }
    if (state.callerKey !== hash) return failWebhook();
    if (phase === "choice") {
      if (form.Digits !== "1") return next();
      const exists = await profileExists(hash);
      return twiml(
        `<Gather input="dtmf" numDigits="6" action="${route("profile", signState(state), { phase: exists ? "unlock" : "create" })}" method="POST" timeout="12">${prompt(state.language, exists ? "history-pin" : "history-new-pin", exists ? "Enter your six digit PIN." : "Choose a six digit PIN using your keypad. Remember it for future calls. Do not use an obvious PIN or share it.")}</Gather><Hangup/>`,
      );
    }
    if (phase !== "unlock" && phase !== "create") return failWebhook();
    const profileId = await unlockProfile(
      hash,
      form.Digits || "",
      phase === "create",
    );
    if (!profileId)
      return twiml(
        prompt(
          state.language,
          "history-unavailable",
          "We could not unlock saved history. After five incorrect attempts it is locked for fifteen minutes. Please call again later, or continue without saved history.",
        ) +
          `<Redirect method="POST">${route("record", signState({ ...state, callerKey: undefined, profileId: undefined }), { phase: "retry" })}</Redirect>`,
      );
    state.profileId = profileId;
    delete state.callerKey;
    return next();
  } catch {
    return failWebhook();
  }
}
