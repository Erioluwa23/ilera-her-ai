import { normalizeLanguage } from "@/lib/languages";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  // Render terminates TLS before Next.js; use its server-provided public URL rather than forwarded headers.
  const expectedOrigin = new URL(process.env.RENDER_EXTERNAL_URL || req.url).origin;
  if ((origin && origin !== expectedOrigin) || req.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Request not allowed" }, { status: 403 });
  }
  const configured = process.env.VOICE_TTS_API_URL;
  if (!configured) return Response.json({ error: "Downloadable reply audio is not configured. You can still replay with a supported device voice." }, { status: 503 });
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
    if (!(process.env.VOICE_TTS_LANGUAGES || "").split(",").map(x => x.trim()).includes(language)) {
      return Response.json({ error: "Saved reply audio is unavailable in this language" }, { status: 503 });
    }
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid provider");
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { "content-type": "application/json", ...(process.env.VOICE_TTS_API_KEY ? { Authorization: `Bearer ${process.env.VOICE_TTS_API_KEY}` } : {}) },
      body: JSON.stringify({ text: body.text, language }),
    });
    const type = (response.headers.get("content-type") || "").split(";")[0];
    if (!response.ok || !response.body || !["audio/mpeg", "audio/wav", "audio/x-wav"].includes(type)) throw new Error("Invalid audio");
    const audioReader = response.body.getReader();
    const audio: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const next = await audioReader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 4 * 1024 * 1024) { await audioReader.cancel(); throw new Error("Audio too large"); }
      audio.push(next.value);
    }
    if (!bytes) throw new Error("Empty audio");
    return new Response(Buffer.concat(audio), { headers: { "content-type": type, "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Reply audio could not be saved. Try again later or use device playback." }, { status: 502 });
  }
}
