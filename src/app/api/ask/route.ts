import { normalizeLanguage } from "@/lib/languages";
import { parseConversation } from "@/lib/voice-chat";
import { requestSession } from "@/lib/request-session";
import { explainAnswer } from "@/lib/ai/answer";
import { boundedJson, BodyTooLarge } from "@/lib/bounded-json";
export async function POST(req: Request) {
  if (!(await requestSession(req)))
    return Response.json(
      { error: "Please sign in first." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  try {
    const body = (await boundedJson(req, 20000)) as Record<string, unknown>;
    if (
      !body ||
      typeof body.question !== "string" ||
      body.question.trim().length < 3 ||
      body.question.length > 1200
    )
      return Response.json(
        { error: "Confirm a health question before asking." },
        { status: 400 },
      );
    if (
      body.language !== undefined &&
      !["en-NG", "yo", "ha", "ig"].includes(String(body.language))
    )
      throw new Error("Unsupported language.");
    if (
      body.currentEpisode !== undefined &&
      !["yes", "no", "unknown"].includes(String(body.currentEpisode))
    )
      throw new Error("Invalid current episode.");
    const language = normalizeLanguage(
        typeof body.language === "string" ? body.language : "en-NG",
      ),
      conversation = parseConversation(body.conversation);
    const response = await explainAnswer(
      body.question.trim(),
      language,
      conversation,
      body.allowExternalAI === true,
      req.signal,
      body.currentEpisode as "yes" | "no" | "unknown" | undefined,
    );
    return Response.json(response, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof BodyTooLarge
            ? "Request too large."
            : "Invalid request. Check the confirmed question and language.",
      },
      {
        status: e instanceof BodyTooLarge ? 413 : 400,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
