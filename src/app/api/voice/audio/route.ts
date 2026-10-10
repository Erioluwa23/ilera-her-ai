import { AsrError } from "@/lib/asr-contract";
import { replyAudio } from "@/lib/reply-audio";
import { normalizeLanguage } from "@/lib/languages";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  // Render terminates TLS before Next.js; use its server-provided public URL rather than forwarded headers.
  const expectedOrigin = new URL(process.env.RENDER_EXTERNAL_URL || req.url).origin;
  if ((origin && origin !== expectedOrigin) || req.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Request not allowed" }, { status: 403 });
  }

  try {
    // Limit untrusted input before decoding it, and never accept a provider URL from a caller.
    const reader = req.body?.getReader();
    if (!reader) return Response.json({ error: "Missing request" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 24000) { await reader.cancel(); return Response.json({ error: "Request too large" }, { status: 413 }); }
      chunks.push(next.value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 6000 ||
      !["en-NG", "yo", "ha", "ig"].includes(body.language)) {
      return Response.json({ error: "Invalid speech request" }, { status: 400 });
    }
    const language = normalizeLanguage(body.language);
    if (process.env.VOICE_TTS_API_URL && !(process.env.VOICE_TTS_LANGUAGES || "").split(",").map(x => x.trim()).includes(language)) {
      return Response.json({ error: "Saved reply audio is unavailable in this language" }, { status: 503 });
    }
    const speech = await replyAudio(body.text, language, req.signal);
    return new Response(new Uint8Array(speech.audio), { headers: { "content-type": speech.contentType, "cache-control": "private, no-store", "x-speech-model": speech.model } });
  } catch (error) {
    if (error instanceof AsrError && error.code === "ASR_QUOTA") return Response.json({ error: "Speech compute quota is exhausted. Please try again later." }, { status: 429 });
    return Response.json({ error: "Reply audio could not be saved. Try again later or use device playback." }, { status: 502 });
  }
}
