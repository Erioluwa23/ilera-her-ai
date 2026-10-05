import { readState } from "@/lib/ivr";
import { getJob } from "@/lib/ivr-jobs";
export async function GET(req: Request) {
  try {
    const state = readState(new URL(req.url).searchParams.get("state") || ""),
      job = await getJob(state);
    if (!state.consented) return new Response(null, { status: 403 });
    if (job?.status !== "ready" || !job.result?.audio)
      return new Response(null, { status: 404 });
    return new Response(
      new Uint8Array(Buffer.from(job.result.audio, "base64")),
      {
        headers: {
          "content-type": job.result.contentType || "audio/mpeg",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(null, { status: 403 });
  }
}
