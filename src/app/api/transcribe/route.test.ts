vi.mock("@/lib/request-session", () => ({
  requestSession: vi.fn(async () => ({ sub: "fixture" })),
}));
import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "./route";
import { POST as apiPost } from "../../v1/audio/transcriptions/route";
import { NatlasSpeechProvider } from "@/lib/natlas";
import { MAX_AUDIO_BYTES } from "@/lib/asr-contract";

function request(audio?: Blob, field = "audio", language = "yo") {
  const form = new FormData();
  if (audio) form.append(field, audio, "sample.wav");
  form.append("language", language);
  return new Request("http://app/api/transcribe", {
    method: "POST",
    body: form,
  });
}
function wav() {
  const b = new Uint8Array(48);
  b.set(new TextEncoder().encode("RIFF"));
  b.set(new TextEncoder().encode("WAVE"), 8);
  return new Blob([b], { type: "audio/wav" });
}
afterEach(() => vi.restoreAllMocks());
describe("web and public API contracts", () => {
  it.each([
    [POST, "audio"],
    [apiPost, "file"],
  ])("preserves both caller fields", async (handler, field) => {
    const transcribe = vi
      .spyOn(NatlasSpeechProvider.prototype, "transcribe")
      .mockResolvedValue({
        text: "Ẹ káàárọ̀",
        model: "NCAIR1/Yoruba-ASR",
        language: "yoruba",
        provider: "ileraher_zerogpu_asr",
        natlas: true,
      });
    const res = await handler(request(wav(), field));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      text: "Ẹ káàárọ̀",
      language: "yoruba",
      model: "NCAIR1/Yoruba-ASR",
      latency_ms: expect.any(Number),
    });
    expect(transcribe.mock.calls[0][1]).toBe("yo");
  });
  it.each([
    [undefined, "yo", 400],
    [new Blob([]), "yo", 400],
    [new Blob(["invalid"], { type: "audio/wav" }), "yo", 415],
    [wav(), "xx", 400],
    [new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]), "yo", 413],
  ])(
    "rejects invalid uploads without upstream calls",
    async (audio, language, status) => {
      const transcribe = vi.spyOn(NatlasSpeechProvider.prototype, "transcribe");
      expect((await POST(request(audio, "audio", language))).status).toBe(
        status,
      );
      expect(transcribe).not.toHaveBeenCalled();
    },
  );
});
