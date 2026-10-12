import { readState } from "@/lib/ivr";
import { getJob } from "@/lib/ivr-jobs";
import { YARN_TTS_MODEL } from "@/lib/yarn-audio";
export async function GET(req: Request) {
  try {
    const state = readState(new URL(req.url).searchParams.get("state") || ""),
      job = await getJob(state);
    if (!state.consented) return new Response(null, { status: 403 });
    if (job?.status !== "ready" || !job.result?.audio ||
        job.result.speechModel !== YARN_TTS_MODEL ||
        job.result.language !== state.language || job.result.contentType !== "audio/wav")
      return new Response(null, { status: 404 });
    const audio = Buffer.from(job.result.audio, "base64");
    if (audio.length < 44 || audio.length > 4 * 1024 * 1024 ||
        audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE")
      return new Response(null, { status: 404 });
    return new Response(
      new Uint8Array(audio),
      {
        headers: {
          "content-type": "audio/wav",
          "x-speech-model": YARN_TTS_MODEL,
          "x-speech-language": state.language,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(null, { status: 403 });
  }
}
