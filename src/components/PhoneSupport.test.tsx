// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ui-language", () => ({ useUI: () => ({ t: (key: string) => key }) }));
import PhoneSupport from "./PhoneSupport";
const fetchMock = vi.fn();
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe("ordinary telephone access", () => {
  it("publishes the verified agent number as a telephone link alongside the internet call", async () => {
    fetchMock.mockResolvedValue(Response.json({ ready: true, phoneNumber: "+2348012345678" }));
    await act(async () => root.render(<PhoneSupport />));
    expect(host.querySelector('a[href="tel:+2348012345678"]')).not.toBeNull();
    expect(host.querySelector('a[href="/call"]')).not.toBeNull();
    expect(host.textContent).toContain("phoneDialHint");
    expect(host.textContent).toContain("ordinaryCallCharges");
  });
  it.each([
    { ready: false, phoneNumber: "+2348012345678" },
    { ready: true, phoneNumber: "javascript:alert(1)" },
    { ready: false, phoneNumber: null },
  ])("does not advertise an unverified agent number: %j", async (status) => {
    fetchMock.mockResolvedValue(Response.json(status));
    await act(async () => root.render(<PhoneSupport />));
    expect(host.querySelector('a[href="tel:+2348012345678"]')).toBeNull();
    expect(host.textContent).toContain("ordinaryCallPending");
    expect(host.textContent).not.toContain("phoneDialHint");
  });
});
