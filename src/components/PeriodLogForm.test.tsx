// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
import PeriodLogForm from "./PeriodLogForm";
import type { PeriodLog } from "@/lib/period-store";
import { DEFAULT_PREFERENCES } from "@/lib/cycle-prediction/types";
let records: PeriodLog[];
let writeFailure = false;
const requests: {
  url: string;
  body: { period: PeriodLog; version: number };
  account: string;
}[] = [];
function state() {
  return {
    userId: "1",
    revision: 1,
    logs: records,
    preferences: { ...DEFAULT_PREFERENCES, consent: true, context: "none" },
    prediction: null,
  };
}
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
  records = [];
  writeFailure = false;
  requests.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method) {
        if (writeFailure) throw new Error("Test network failure");
        const body = JSON.parse(options.body as string);
        requests.push({
          url,
          body,
          account: (options.headers as Record<string, string>)[
            "x-ileraher-account"
          ],
        });
        records = [
          ...records.filter((x) => x.id !== body.period.id),
          { ...body.period, version: 2 },
        ];
      }
      return new Response(JSON.stringify(state()), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
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
    records = [
      { ...fixture, version: 1 } as PeriodLog,
      {
        id: "other",
        startDate: "2025-12-01",
        flow: "light",
        pain: 1,
        version: 1,
      },
    ];
    await mount("2026-01-02", "old");
    await click("Heavy");
    await click("Save log");
    const logs = records;
    const edited = logs.find((x) => x.id === "old")!;
    expect(requests[0]).toMatchObject({
      url: "/api/v1/periods/old",
      account: "1",
      body: { version: 1 },
    });
    expect(localStorage.getItem("ileraher-periods-v2")).toBeNull();
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
    records = [
      {
        ...fixture,
        endDate: undefined,
        entries: undefined,
        version: 1,
      } as PeriodLog,
    ];
    await mount("2026-01-01", "old");
    expect(
      (host.querySelector('input[type="checkbox"]') as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
  it("keeps an account-scoped dirty draft when the server save fails", async () => {
    await mount();
    await click("Heavy");
    writeFailure = true;
    await click("Save log");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("ileraher-log-draft:1:2026-01-02")).toContain(
      '"flow":"heavy"',
    );
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(records).toEqual([]);
  });
  it("never automatically uploads shared browser history", async () => {
    localStorage.setItem("ileraher-periods-v2", JSON.stringify([fixture]));
    await mount();
    expect(requests).toEqual([]);
    expect(records).toEqual([]);
    expect(localStorage.getItem("ileraher-periods-v2")).toContain(
      "Original episode note",
    );
  });
});
