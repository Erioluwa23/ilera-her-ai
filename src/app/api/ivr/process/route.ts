import { after } from "next/server";
import { enqueue } from "@/lib/ivr-jobs";
import { runJob } from "@/lib/ivr-worker";
import { failWebhook, readState, webhook } from "@/lib/ivr";
export async function POST(req: Request) {
  try {
    const form = await webhook(req),
      state = readState(
        new URL(req.url).searchParams.get("state") || "",
        form.CallSid,
      );
    if (
      !state.consented ||
      form.RecordingStatus !== "completed" ||
      !/^RE[a-f0-9]{32}$/i.test(form.RecordingSid || "")
    )
      return new Response(null, { status: 400 });
    try {
      await enqueue(state, form.RecordingSid);
    } catch {
      return new Response("Queue unavailable", { status: 503 });
    }
    after(async () => {
      try {
        await runJob(state);
      } catch {
        console.warn("IVR job could not start");
      }
    });
    return new Response(null, { status: 204 });
  } catch {
    return failWebhook();
  }
}
