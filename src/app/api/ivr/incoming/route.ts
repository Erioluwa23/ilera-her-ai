import {
  configuration,
  failWebhook,
  route,
  say,
  twiml,
  webhook,
} from "@/lib/ivr";
export async function POST(req: Request) {
  try {
    await webhook(req);
  } catch {
    return failWebhook();
  }
  if (!configuration().configured)
    return twiml(
      say(
        "IleraHer phone support is not available yet. Please try again later.",
      ) + "<Hangup/>",
    );
  const attempt = Math.min(
    3,
    Number(new URL(req.url).searchParams.get("attempt")) || 0,
  );
  if (attempt >= 3)
    return twiml(
      say("We did not receive a valid choice. Goodbye.") + "<Hangup/>",
    );
  return twiml(
    `<Gather input="dtmf" numDigits="1" action="${route("record", undefined, { phase: "language", attempt: String(attempt + 1) })}" method="POST" timeout="8">${say("Welcome to IleraHer. For Nigerian English, press 1. For Yoruba, press 2. For Hausa, press 3. For Igbo, press 4.")}</Gather><Redirect method="POST">${route("incoming", undefined, { attempt: String(attempt + 1) })}</Redirect>`,
  );
}
