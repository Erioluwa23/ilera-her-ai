// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { VoiceMessage } from "@/lib/voice-chat";
import { YARN_TTS_MODEL } from "@/lib/yarn-audio";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/voice-chat-store", () => ({
  loadVoiceMessages: mocks.load,
  saveVoiceMessage: mocks.save,
  deleteVoiceMessage: mocks.remove,
  deleteVoiceConversation: mocks.remove,
}));
import VoiceLog from "./VoiceLog";
class Recorder {
  static current: Recorder;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (e: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor() {
    Recorder.current = this;
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["test recording"], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
let root: Root, host: HTMLDivElement;
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function click(text: string) {
  const el = Array.from(host.querySelectorAll("button")).find(
    (b) =>
      b.textContent?.trim() === text || b.getAttribute("aria-label") === text,
  );
  expect(el, `button ${text}`).toBeTruthy();
  await act(async () => {
    el!.click();
  });
  await settle();
}
async function mount() {
  await act(async () => root.render(<VoiceLog />));
  await settle();
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  vi.clearAllMocks();
  mocks.load.mockResolvedValue([]);
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    },
  });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.scrollTo = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("explicit voice review workflow", () => {
  it("stops and saves recording without uploading; supports pause and resume", async () => {
    localStorage.setItem("ileraher-voice-consent-v2", "yes");
    await mount();
    await click("Tap to record");
    expect(Recorder.current.state).toBe("recording");
    await click("Pause");
    expect(Recorder.current.state).toBe("paused");
    await click("Resume");
    expect(Recorder.current.state).toBe("recording");
    await click("Review");
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, audio: expect.any(Blob) }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(host.querySelector("dialog[open]")).toBeTruthy();
  });
  it("discloses processing before requesting microphone access", async () => {
    await mount();
    await click("Tap to record");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(host.textContent).toContain("speech service");
  });
  it("restores a draft while offline without silently uploading it", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.load.mockResolvedValue([
      {
        id: "draft",
        conversationId: "one",
        role: "user",
        language: "en-NG",
        createdAt: 1,
        text: "Retained draft",
        draft: true,
      } satisfies VoiceMessage,
    ]);
    await mount();
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "Retained draft",
    );
    const send = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Send message",
    );
    expect(send?.disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends a restored draft only on explicit Send and preserves retry data on failure", async () => {
    mocks.load.mockResolvedValue([
      {
        id: "draft",
        conversationId: "one",
        role: "user",
        language: "en-NG",
        createdAt: 1,
        text: "Synthetic test question",
        draft: true,
      } satisfies VoiceMessage,
    ]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Test network failure" }), {
        status: 503,
      }),
    );
    await mount();
    expect(fetch).not.toHaveBeenCalled();
    await click("Send message");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/ask");
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: "Synthetic test question",
        confirmed: true,
        error: "Test network failure",
      }),
    );
    expect(host.textContent).toContain("Try again");
  });
  it("does not label a failed storage write as saved", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Test storage full"));
    localStorage.setItem("ileraher-voice-consent-v2", "yes");
    await mount();
    await click("Tap to record");
    await click("Review");
    expect(host.textContent).toContain("Test storage full");
    expect(host.textContent).toContain("Not saved");
  });
  it("stops at 60 active seconds and still does not upload", async () => {
    localStorage.setItem("ileraher-voice-consent-v2", "yes");
    await mount();
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
        "performance",
      ],
    });
    try {
      await act(async () => {
        host
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Tap to record"]',
          )!
          .click();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60500);
      });
      expect(Recorder.current.state).toBe("inactive");
      expect(mocks.save).toHaveBeenCalledTimes(1);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

function assistant(language: VoiceMessage["language"] = "en-NG"): VoiceMessage {
  return { id: "answer", conversationId: "one", role: "assistant", createdAt: 1,
    language, text: "Synthetic reply", disclaimer: "Synthetic care notice" };
}
function audioResponse(language: string) {
  return new Response(new Uint8Array([1, 2, 3]), { headers: {
    "content-type": "audio/wav", "x-speech-model": YARN_TTS_MODEL, "x-speech-language": language,
  } });
}
describe("YarnGPT is the chat speaker", () => {
  it.each(["en-NG", "yo", "ig", "ha"] as const)("listens in %s, saves verified audio, and replays without another request", async language => {
    const speak = vi.fn(); vi.stubGlobal("speechSynthesis", { speak });
    mocks.load.mockResolvedValue([assistant(language)]);
    vi.mocked(fetch).mockResolvedValue(audioResponse(language));
    await mount();
    expect(fetch).not.toHaveBeenCalled();
    expect(host.textContent).toContain("YarnGPT voice");
    expect(host.textContent).not.toContain("Device voice");
    await click("Listen to reply");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
      text: "Synthetic reply Synthetic care notice", language,
    });
    expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({
      id: "answer", audioModel: YARN_TTS_MODEL, filename: "ileraher-answer.wav",
    }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    await click("Pause");
    await click("Play audio");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(speak).not.toHaveBeenCalled();
  });
  it("keeps the reply when quota is exhausted and never calls device speech", async () => {
    const speak = vi.fn(); vi.stubGlobal("speechSynthesis", { speak });
    mocks.load.mockResolvedValue([assistant("yo")]);
    vi.mocked(fetch).mockResolvedValue(new Response("quota", { status: 429 }));
    await mount(); await click("Listen to reply");
    expect(host.textContent).toContain("Synthetic reply");
    expect(host.textContent).toContain("YarnGPT's speech limit has been reached");
    expect(mocks.save.mock.calls.at(-1)?.[0].audio).toBeUndefined();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
  it("shows Hugging Face's retry date and time in WAT on a failed listening request", async () => {
    mocks.load.mockResolvedValue([assistant("yo")]);
    vi.mocked(fetch).mockResolvedValue(Response.json({code:"TTS_QUOTA",retryAt:"2026-10-12T23:30:00.000Z"},{status:429}));
    await mount(); await click("Listen to reply");
    expect(host.textContent).toContain("Quota exhausted. Try again at 13 Oct, 12:30:00 AM WAT.");
    expect(host.textContent).toContain("Synthetic reply");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("discards a cancelled generation even if the network later returns audio", async () => {
    mocks.load.mockResolvedValue([assistant()]);
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await mount(); await click("Listen to reply");
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    await click("Cancel");
    expect(signal?.aborted).toBe(true);
    await act(async () => { complete(audioResponse("en-NG")); });
    await settle();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("plays persisted YarnGPT audio offline without regenerating it", async () => {
    const message = { ...assistant(), audio: new Blob(["saved"], { type: "audio/wav" }), audioModel: YARN_TTS_MODEL };
    mocks.load.mockResolvedValue([message]);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await mount(); await click("Play audio");
    expect(fetch).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
  it("does not attribute an old unknown speaker to YarnGPT", async () => {
    mocks.load.mockResolvedValue([{ ...assistant(), audio: new Blob(["old-provider"], { type: "audio/wav" }) }]);
    vi.mocked(fetch).mockResolvedValue(audioResponse("en-NG"));
    await mount(); await click("Listen to reply");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ audioModel: YARN_TTS_MODEL }));
  });
});
