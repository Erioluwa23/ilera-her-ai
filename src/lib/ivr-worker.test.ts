import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  finish: vi.fn(),
  getJob: vi.fn(),
  history: vi.fn(),
  transcribe: vi.fn(),
  answer: vi.fn(),
  remove: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("./ivr-jobs", () => ({
  claim: mocks.claim,
  finish: mocks.finish,
  getJob: mocks.getJob,
}));
vi.mock("./ivr-profiles", () => ({ callerHistory: mocks.history }));
vi.mock("./natlas", () => ({
  NatlasSpeechProvider: class {
    transcribe = mocks.transcribe;
  },
  NatlasLLMProvider: class {
    answer = mocks.answer;
  },
}));
vi.mock("twilio", () => ({
  default: () => ({ recordings: () => ({ remove: mocks.remove }) }),
}));
import { runJob } from "./ivr-worker";
import type { CallState } from "./ivr";
const state: CallState = {
  id: "12345678-1234-1234-1234-123456789abc",
  call: "CA" + "b".repeat(32),
  language: "en-NG",
  expires: Date.now() + 600000,
  consented: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC" + "a".repeat(32));
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test");
  vi.stubEnv("AI_PROVIDER_MODE", "natlas");
  mocks.claim.mockResolvedValue({
    recording: "RE" + "c".repeat(32),
    lease: "lease",
  });
  mocks.fetch.mockImplementation(
    async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/wav" },
      }),
  );
  mocks.transcribe.mockResolvedValue({ text: "My periods are irregular" });
  mocks.history.mockResolvedValue([]);
  mocks.getJob.mockResolvedValue(null);
  mocks.answer.mockResolvedValue({ text: "generated guidance" });
});
describe("contextual phone worker", () => {
  it("passes the selected language and dated unlocked history to the official providers", async () => {
    const history = [
      {
        question: "Previous cramps",
        answer: "prior advice",
        language: "yo",
        recordedAt: "2026-10-01T00:00:00Z",
      },
    ];
    mocks.history.mockResolvedValue(history);
    vi.stubEnv("IVR_TTS_API_URL", "https://tts.example.test");
    await runJob({
      ...state,
      language: "yo",
      profileId: "22345678-1234-1234-1234-123456789abc",
    });
    expect(mocks.transcribe.mock.calls[0][1]).toBe("yo");
    expect(mocks.answer.mock.calls[0][1].callerHistory).toEqual(history);
    expect(mocks.answer.mock.calls[0][2]).toBe("yo");
    expect(mocks.finish.mock.calls[0][2].question).toBe(
      "My periods are irregular",
    );
    expect(mocks.remove).toHaveBeenCalled();
  });
  it("keeps urgent symptoms across successive follow-ups and reads care instructions", async () => {
    mocks.transcribe.mockResolvedValue({ text: "What should I do next?" });
    mocks.getJob.mockResolvedValue({
      status: "ready",
      result: {
        text: "previous guidance",
        question: "What now?",
        reported: ["I have heavy bleeding and feel faint", "What now?"],
      },
    });
    await runJob({ ...state, previous: state.id });
    expect(mocks.answer).not.toHaveBeenCalled();
    const result = mocks.finish.mock.calls[0][2];
    expect(result.text).toContain("Seek urgent care");
    expect(result.reported).toHaveLength(3);
  });
  it("does not turn an old saved urgent report into a current emergency", async () => {
    mocks.history.mockResolvedValue([
      {
        question: "I had heavy bleeding and felt faint",
        answer: "urgent advice",
        language: "en-NG",
        recordedAt: "2026-09-10T00:00:00Z",
      },
    ]);
    await runJob(state);
    expect(mocks.answer).toHaveBeenCalled();
  });
  it("speaks reviewed guidance when generation is unavailable and cleans the recording", async () => {
    mocks.answer.mockRejectedValue(new Error("gated model unavailable"));
    await runJob(state);
    expect(mocks.finish.mock.calls[0][2].text).toContain("pregnancy test");
    expect(mocks.remove).toHaveBeenCalled();
  });
  it("does not process duplicate callbacks without a lease", async () => {
    mocks.claim.mockResolvedValue(null);
    await runJob(state);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});
