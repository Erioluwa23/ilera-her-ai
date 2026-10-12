import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { INITIAL_CALL, type CallSnapshot } from "@/lib/agent-call-client";
import type { IlaraLanguage } from "@/lib/languages";
const state = vi.hoisted(() => ({ language: "en-NG" as IlaraLanguage, call: null as CallSnapshot | null }));
vi.mock("@/lib/ui-language", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/ui-language")>();
  return { ...original, useUI: () => ({ language: state.language, setLanguage: vi.fn(), t: (key: import("@/lib/ui-language").UIKey) => original.uiText(key, state.language) }) };
});
vi.mock("@/lib/use-agent-call", () => ({ useAgentCall: () => ({ call: state.call, client: {} }) }));
import AgentCall from "./AgentCall";
import PhoneSupport from "./PhoneSupport";
import { formatQuotaTime } from "@/lib/quota-retry";
describe("call interface", () => {
  it.each(["en-NG", "yo", "ha", "ig"] as const)("offers calling with consent and internet guidance, without sandbox wording, in %s", language => {
    state.language = language; state.call = { ...INITIAL_CALL };
    const page = renderToStaticMarkup(<AgentCall />), card = renderToStaticMarkup(<PhoneSupport />);
    expect(page).not.toMatch(/sandbox/i); expect(page).toContain("Powered by N-ATLaS");
    expect(page).toContain('type="checkbox"'); expect(page).toContain('disabled=""');
    expect(page).toContain('value="yo"'); expect(page).toContain('value="ha"'); expect(page).toContain('value="ig"');
    expect(card).toContain('href="/call"');
    if (language === "en-NG") { expect(page).toContain("internet connection"); expect(card).not.toContain("No internet needed"); }
  });
  it("renders the exact WAT quota retry time", () => {
    state.language = "en-NG"; const retryAt = "2026-10-12T16:33:29.000Z";
    state.call = { ...INITIAL_CALL, phase: "error", error: "asrQuota", retryAt };
    const html = renderToStaticMarkup(<AgentCall />);
    expect(html).toContain(formatQuotaTime(retryAt)); expect(html).toContain("Quota exhausted");
  });
});
