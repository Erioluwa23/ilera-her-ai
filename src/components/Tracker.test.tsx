// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tracker from "./Tracker";
import { DEFAULT_PREFERENCES } from "@/lib/cycle-prediction/types";
import { predictNextPeriod } from "@/lib/cycle-prediction/engine";
const prefs = {
  ...DEFAULT_PREFERENCES,
  consent: true,
  context: "none" as const,
  reportedCycleLength: 29,
};
const logs = [
  {
    id: "p2",
    startDate: "2026-10-01",
    endDate: "2026-10-04",
    flow: "medium",
    pain: 2,
  },
  {
    id: "p1",
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    flow: "light",
    pain: 1,
  },
];
let root: Root,
  host: HTMLDivElement,
  forecast = predictNextPeriod(logs, prefs, "2026-10-10"),
  consent = true;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  forecast = predictNextPeriod(logs, prefs, "2026-10-10");
  consent = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            userId: "1",
            revision: 2,
            logs: consent ? logs : [],
            preferences: { ...prefs, consent },
            prediction: forecast,
          }),
        ),
    ),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount() {
  await act(async () => {
    root.render(<Tracker />);
  });
}
describe("personalized calendar", () => {
  it("renders the API estimate instead of the old client-side average", async () => {
    await mount();
    expect(forecast.predictedDate).toBe("2026-10-30");
    const estimated = host.querySelectorAll(".ux-calendar-grid .is-estimate");
    expect(estimated).toHaveLength(1);
    expect(estimated[0].textContent).toBe("30");
    expect(host.textContent).toContain("Limited history");
    expect(host.textContent).toContain("not a guarantee");
  });
  it("navigates months and returns to today without fixed calendar dates", async () => {
    await mount();
    await act(async () => {
      (
        host.querySelector('[aria-label="Next month"]') as HTMLButtonElement
      ).click();
    });
    expect(host.querySelector(".ux-calendar-heading")?.textContent).toContain(
      "November 2026",
    );
    const todayButton = Array.from(
      host.querySelectorAll(".ux-calendar-footer button"),
    ).find((x) => x.textContent === "Today")!;
    await act(async () => {
      (todayButton as HTMLButtonElement).click();
    });
    expect(host.querySelector(".ux-calendar-heading")?.textContent).toContain(
      "October 2026",
    );
  });
  it("does not invent a prediction range or confidence percentage", async () => {
    await mount();
    expect(host.textContent).toContain("not enough measured prediction error");
    expect(host.textContent).not.toMatch(/\d+%/);
  });
  it("shows an empirical window only when the API supplies one", async () => {
    forecast = {
      ...forecast,
      windowStart: "2026-10-28",
      windowEnd: "2026-11-02",
      uncertaintyStatus: "empirical_estimate",
      calibrationSamples: 8,
    };
    await mount();
    expect(
      host.querySelectorAll(".ux-calendar-grid .is-estimate"),
    ).toHaveLength(4);
    expect(host.textContent).toContain("not a validated confidence interval");
  });
  it("keeps predictions paused and calendar estimates empty for relevant context", async () => {
    forecast = predictNextPeriod(
      logs,
      { ...prefs, context: "breastfeeding" },
      "2026-10-10",
    );
    await mount();
    expect(
      host.querySelectorAll(".ux-calendar-grid .is-estimate"),
    ).toHaveLength(0);
    expect(host.textContent).toContain("Estimates are paused");
  });
  it("never displays shared browser records as account history", async () => {
    consent = false;
    localStorage.setItem("ileraher-periods-v2", JSON.stringify(logs));
    await mount();
    expect(host.textContent).toContain("Set up private tracking");
    expect(host.querySelector(".ux-calendar-grid")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("reads an insight on demand using a local device voice", async () => {
    const speak = vi.fn();
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      function (this: { text: string }, text: string) {
        this.text = text;
      },
    );
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      getVoices: () => [{ lang: "en-NG", localService: true }],
      speak,
      pause: vi.fn(),
      resume: vi.fn(),
    });
    await mount();
    expect(speak).not.toHaveBeenCalled();
    const button = Array.from(host.querySelectorAll("button")).find((x) =>
      x.textContent?.includes("Listen to insight"),
    )!;
    await act(async () => {
      button.click();
    });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toContain("30 October 2026");
  });
  it("does not send cycle insight to a remote device voice when no local language voice exists", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      getVoices: () => [{ lang: "en-NG", localService: false }],
      speak,
    });
    await mount();
    const button = Array.from(host.querySelectorAll("button")).find((x) =>
      x.textContent?.includes("Listen to insight"),
    )!;
    await act(async () => {
      button.click();
    });
    expect(speak).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Device voice unavailable");
  });
});
