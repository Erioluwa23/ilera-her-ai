import { beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  key: vi.fn(),
  exists: vi.fn(),
  unlock: vi.fn(),
  forget: vi.fn(),
}));
vi.mock("@/lib/ivr-profiles", () => ({
  historyEnabled: mocks.enabled,
  callerKey: mocks.key,
  profileExists: mocks.exists,
  unlockProfile: mocks.unlock,
  forgetProfile: mocks.forget,
}));
import { POST } from "./route";
import { readState, signState, stateToken } from "@/lib/ivr";
const call = "CA" + "b".repeat(32),
  account = "AC" + "a".repeat(32),
  hash = "d".repeat(64),
  profile = "22345678-1234-1234-1234-123456789abc",
  origin = "https://ivr.example.test";
function req(
  phase: string,
  token: string,
  digits = "",
  from = "+2348012345678",
  signed = true,
) {
  const url = origin + "/api/ivr/profile?phase=" + phase + "&state=" + token,
    values = { AccountSid: account, CallSid: call, From: from, Digits: digits };
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(signed
        ? {
            "x-twilio-signature": twilio.getExpectedTwilioSignature(
              "auth",
              url,
              values,
            ),
          }
        : {}),
    },
    body: new URLSearchParams(values),
  });
}
function token(consented = true) {
  return stateToken(call, "en-NG", consented);
}
function target(xml: string, tag = "Redirect") {
  return new URL(
    xml
      .match(new RegExp("<" + tag + "[^>]*>(https:[^<]+)</" + tag + ">"))![1]
      .replaceAll("&amp;", "&"),
  );
}
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", account);
  vi.stubEnv("TWILIO_AUTH_TOKEN", "auth");
  vi.stubEnv("IVR_PUBLIC_BASE_URL", origin);
  vi.stubEnv("IVR_SESSION_SECRET", "session".repeat(8));
  mocks.enabled.mockReturnValue(true);
  mocks.key.mockReturnValue(hash);
  mocks.exists.mockResolvedValue(false);
  mocks.unlock.mockResolvedValue(profile);
});
describe("signed voice-only profile menus", () => {
  it("rejects unsigned requests and unconsented states", async () => {
    expect(
      (await POST(req("start", token(), "", "+2348012345678", false))).status,
    ).toBe(403);
    expect((await POST(req("start", token(false)))).status).toBe(403);
  });
  it("offers an explicit choice without including the raw phone number", async () => {
    const xml = await (await POST(req("start", token()))).text();
    expect(xml).toContain("without saved history");
    expect(xml).not.toContain("+2348012345678");
    expect(xml).toContain('numDigits="1"');
  });
  it("allows withheld caller IDs to proceed as guests", async () => {
    mocks.key.mockReturnValue(undefined);
    const xml = await (
      await POST(req("start", token(), "", "anonymous"))
    ).text();
    expect(target(xml).pathname).toBe("/api/ivr/record");
    expect(mocks.exists).not.toHaveBeenCalled();
  });
  it("enrols with a keypad PIN and carries the unlocked profile into recording", async () => {
    const state = readState(token());
    state.callerKey = hash;
    const xml = await (await POST(req("choice", signState(state), "1"))).text();
    expect(xml).toContain('numDigits="6"');
    expect(xml).toContain("Choose a six digit PIN");
    const next = await (
      await POST(req("create", signState(state), "728394"))
    ).text();
    expect(mocks.unlock).toHaveBeenCalledWith(hash, "728394", true);
    const result = readState(target(next).searchParams.get("state")!);
    expect(result.profileId).toBe(profile);
    expect(result.callerKey).toBeUndefined();
    expect(next).not.toContain("728394");
  });
  it("asks returning callers for their PIN before accessing saved history", async () => {
    mocks.exists.mockResolvedValue(true);
    const state = readState(token());
    state.callerKey = hash;
    const xml = await (await POST(req("choice", signState(state), "1"))).text();
    expect(xml).toContain("Enter your six digit PIN");
    expect(xml).toContain("phase=unlock");
    expect(mocks.unlock).not.toHaveBeenCalled();
  });
  it("does not enrol a caller who declines history", async () => {
    const state = readState(token());
    state.callerKey = hash;
    const xml = await (await POST(req("choice", signState(state), "2"))).text();
    expect(target(xml).pathname).toBe("/api/ivr/record");
    expect(mocks.unlock).not.toHaveBeenCalled();
  });
  it("refuses a caller identity change before PIN validation", async () => {
    const state = readState(token());
    state.callerKey = "e".repeat(64);
    expect((await POST(req("unlock", signState(state), "728394"))).status).toBe(
      403,
    );
    expect(mocks.unlock).not.toHaveBeenCalled();
  });
  it("continues without a profile after an incorrect or locked PIN", async () => {
    mocks.unlock.mockResolvedValue(null);
    const state = readState(token());
    state.callerKey = hash;
    const xml = await (
      await POST(req("unlock", signState(state), "123456"))
    ).text();
    expect(
      readState(target(xml).searchParams.get("state")!).profileId,
    ).toBeUndefined();
    expect(xml).toContain("could not unlock");
  });
  it("requires confirmation before deleting and then ends the call", async () => {
    const state = readState(token());
    state.profileId = profile;
    await POST(req("manage", signState(state)));
    expect(mocks.forget).not.toHaveBeenCalled();
    const xml = await (await POST(req("delete", signState(state), "1"))).text();
    expect(mocks.forget).toHaveBeenCalledWith(state);
    expect(xml).toContain("deleted");
    expect(xml).toContain("<Hangup/>");
  });
});
