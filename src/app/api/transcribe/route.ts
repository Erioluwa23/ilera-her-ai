import { requestSession } from "@/lib/request-session";
import { NatlasSpeechProvider } from "@/lib/natlas";
import { normalizeLanguage } from "@/lib/languages";
import { AsrError, readAudioForm, validateAudio } from "@/lib/asr-contract";
import { classifyAsrError } from "@/lib/natlas-space";

export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!(await requestSession(req)))
    return Response.json(
      { error: "Please sign in first." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  try {
    const data = await readAudioForm(req);
    const audio = data.get("audio") ?? data.get("file");
    if (!(audio instanceof Blob))
      throw new AsrError("AUDIO_REQUIRED", 400, "Audio is required.");
    await validateAudio(audio);
    const value = data.get("language");
    if (value !== null && typeof value !== "string")
      throw new AsrError("LANGUAGE_INVALID", 400, "Unsupported language.");
    let language;
    try {
      language = normalizeLanguage(value);
    } catch {
      throw new AsrError("LANGUAGE_INVALID", 400, "Unsupported language.");
    }
    const started = Date.now();
    const result = await new NatlasSpeechProvider().transcribe(
      audio,
      language,
      req.signal,
    );
    return Response.json(
      { ...result, latency_ms: Date.now() - started },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const failure = classifyAsrError(error);
    return Response.json(
      { error: failure.message, code: failure.code },
      { status: failure.status, headers: { "cache-control": "no-store" } },
    );
  }
}
