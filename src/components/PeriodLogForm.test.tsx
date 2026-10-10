// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
import PeriodLogForm from "./PeriodLogForm";
let root: Root, host: HTMLDivElement;
const fixture = {
  id: "old",
  startDate: "2026-01-01",
  endDate: "2026-01-03",
  flow: "medium",
  pain: 2,
  notes: "Original episode note",
  entries: [
    { date: "2026-01-01", flow: "medium", pain: 2, notes: "First day note" },
  ],
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function mount(date = "2026-01-02", id?: string) {
  await act(async () => {
    root.render(<PeriodLogForm initialDate={date} recordId={id} />);
  });
}
async function click(text: string) {
  const el = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  expect(el).toBeTruthy();
  await act(async () => el!.click());
}
describe("record editing", () => {
  it("adds a daily flow log without losing prior day notes or other episodes", async () => {
    localStorage.setItem(
      "ileraher-periods-v2",
      JSON.stringify([
        fixture,
        { id: "other", startDate: "2025-12-01", flow: "light", pain: 1 },
      ]),
    );
    await mount("2026-01-02", "old");
    await click("Heavy");
    await click("Save log");
    const logs = JSON.parse(localStorage.getItem("ileraher-periods-v2")!);
    const edited = logs.find((x: { id: string }) => x.id === "old");
    expect(edited.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-01-01",
          notes: "First day note",
        }),
        expect.objectContaining({ date: "2026-01-02", flow: "heavy" }),
      ]),
    );
    expect(logs.some((x: { id: string }) => x.id === "other")).toBe(true);
    expect(navigation.push).toHaveBeenCalledWith(
      "/cycle?date=2026-01-02&saved=1",
    );
  });
  it("preserves legacy unknown duration when editing", async () => {
    localStorage.setItem(
      "ileraher-periods-v2",
      JSON.stringify([{ ...fixture, endDate: undefined, entries: undefined }]),
    );
    await mount("2026-01-01", "old");
    expect(
      (host.querySelector('input[type="checkbox"]') as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
  it("keeps a dirty draft for reload when device persistence fails", async () => {
    await mount();
    await click("Heavy");
    const real = Storage.prototype.setItem;
    const limited = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "ileraher-periods-v2") throw new Error("Test quota");
        return real.call(this, key, value);
      });
    try {
      await click("Save log");
      expect(navigation.push).not.toHaveBeenCalled();
      expect(sessionStorage.getItem("ileraher-log-draft:2026-01-02")).toContain(
        '"flow":"heavy"',
      );
      expect(host.querySelector('[role="alert"]')).toBeTruthy();
    } finally {
      limited.mockRestore();
    }
  });
});
