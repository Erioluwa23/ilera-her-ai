// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CycleSetup from "./CycleSetup";
import { usePeriodLogs } from "@/lib/period-store";
import { DEFAULT_PREFERENCES } from "@/lib/cycle-prediction/types";
const fixture = {
  id: "legacy1",
  startDate: "2026-09-01",
  endDate: "2026-09-04",
  flow: "light",
  pain: 1,
};
let root: Root,
  host: HTMLDivElement,
  preferences = { ...DEFAULT_PREFERENCES },
  logs: (typeof fixture)[] = [],
  writes: { url: string; body: any }[] = [];
function Screen() {
  const store = usePeriodLogs();
  return <CycleSetup store={store} />;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  preferences = { ...DEFAULT_PREFERENCES };
  logs = [];
  writes = [];
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method) {
        const body = JSON.parse(options.body as string);
        writes.push({ url, body });
        if (url.endsWith("preferences")) preferences = body.preferences;
        if (url.endsWith("import")) logs = body.periods;
      }
      return new Response(
        JSON.stringify({
          userId: "1",
          revision: 1,
          logs,
          preferences,
          prediction: null,
        }),
      );
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => root.render(<Screen />));
}
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find((x) =>
    x.textContent?.includes(text),
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
describe("consent and explicit browser migration", () => {
  it("starts without a reported length, reminder opt-in or preselected consent", async () => {
    await mount();
    await click("Set up private tracking");
    const dialog = host.querySelector("dialog")!;
    expect(
      Array.from(dialog.querySelectorAll('input[type="number"]')).map(
        (x) => (x as HTMLInputElement).value,
      ),
    ).toEqual(["", ""]);
    expect(
      Array.from(dialog.querySelectorAll('input[type="checkbox"]')).every(
        (x) => !(x as HTMLInputElement).checked,
      ),
    ).toBe(true);
    await act(async () => {
      (
        dialog.querySelector('input[type="checkbox"]') as HTMLInputElement
      ).click();
    });
    await act(async () => {
      dialog
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(writes[0]).toMatchObject({
      url: "/api/v1/cycles/preferences",
      body: {
        preferences: {
          consent: true,
          reportedCycleLength: null,
          reportedPeriodLength: null,
          reminderConsent: false,
          context: "not_provided",
        },
      },
    });
    expect(host.querySelector("dialog")).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      "Saved privately to your account",
    );
  });
  it("uploads nothing until selection and ownership are explicitly confirmed", async () => {
    preferences = { ...DEFAULT_PREFERENCES, consent: true };
    localStorage.setItem("ileraher-periods-v2", JSON.stringify([fixture]));
    await mount();
    expect(writes).toEqual([]);
    await click("Review and import");
    const dialog = host.querySelector("dialog")!,
      button = Array.from(dialog.querySelectorAll("button")).find(
        (x) => x.textContent === "Import selected records",
      )!;
    expect(button.disabled).toBe(true);
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
    await act(async () => {
      (checkboxes[0] as HTMLInputElement).click();
    });
    expect(button.disabled).toBe(true);
    await act(async () => {
      (checkboxes[1] as HTMLInputElement).click();
    });
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      url: "/api/v1/periods/import",
      body: { periods: [fixture] },
    });
    expect(localStorage.getItem("ileraher-periods-v2")).toContain("legacy1");
  });
  it("requires account storage consent even after acknowledging browser ownership", async () => {
    localStorage.setItem("ileraher-periods-v2", JSON.stringify([fixture]));
    await mount();
    await click("Review and import");
    for (const input of host.querySelectorAll('dialog input[type="checkbox"]'))
      await act(async () => {
        (input as HTMLInputElement).click();
      });
    const button = Array.from(host.querySelectorAll("button")).find(
      (x) => x.textContent === "Import selected records",
    )!;
    expect(button.disabled).toBe(true);
    expect(writes).toEqual([]);
  });
});
