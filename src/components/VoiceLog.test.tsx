// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { VoiceMessage } from "@/lib/voice-chat";
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
