import { beforeEach, describe, it, expect, vi } from "vitest";
import twilio from "twilio";
import {
  configuration,
  readState,
  stateToken,
  encryptResult,
  decryptResult,
  webhook,
} from "./ivr";
import { POST as incoming } from "@/app/api/ivr/incoming/route";
import { POST as record } from "@/app/api/ivr/record/route";
import { POST as processRecording } from "@/app/api/ivr/process/route";
import { POST as wait } from "@/app/api/ivr/wait/route";
const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  getJob: vi.fn(),
  runJob: vi.fn(),
  after: vi.fn(),
}));
vi.mock("./ivr-jobs", () => ({ enqueue: mocks.enqueue, getJob: mocks.getJob }));
vi.mock("./ivr-worker", () => ({ runJob: mocks.runJob }));
vi.mock("next/server", () => ({ after: mocks.after }));
const origin = "https://ivr.example.test",
  account = "AC" + "a".repeat(32),
  call = "CA" + "b".repeat(32),
  recording = "RE" + "c".repeat(32),
  token = "test-auth-token";
function request(
  path: string,
  extra: Record<string, string> = {},
  sign = true,
) {
  const values = { AccountSid: account, CallSid: call, ...extra },
    url = origin + path;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(sign
        ? {
            "x-twilio-signature": twilio.getExpectedTwilioSignature(
              token,
              url,
              values,
            ),
          }
        : {}),
    },
    body: new URLSearchParams(values),
  });
}
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const [k, v] of Object.entries({
    TWILIO_ACCOUNT_SID: account,
    TWILIO_AUTH_TOKEN: token,
    IVR_PUBLIC_BASE_URL: origin,
    IVR_ENABLED: "true",
    IVR_PHONE_NUMBER: "+441234567890",
    IVR_SESSION_SECRET: "test-session-secret".repeat(3),
    IVR_DATABASE_URL: "postgresql://test",
    NATLAS_LLM_API_URL: "https://llm.example.test",
    IVR_PROMPT_BASE_URL: "https://audio.example.test/prompts/",
    IVR_TTS_API_URL: "https://tts.example.test",
    IVR_TTS_LANGUAGES: "yo,ha,ig",
  }))
    vi.stubEnv(k, v);
  mocks.enqueue.mockResolvedValue(undefined);
  mocks.getJob.mockResolvedValue(null);
});
describe("authenticated phone call journey", () => {
  it("rejects unsigned callbacks", async () =>
    expect(
      (await incoming(request("/api/ivr/incoming", {}, false))).status,
    ).toBe(403));
  it("validates the full URL including query parameters", async () => {
    const req = request("/api/ivr/record?phase=language", { Digits: "2" });
    expect((await webhook(req)).Digits).toBe("2");
    const bad = request("/api/ivr/record?phase=language", { Digits: "2" });
    expect(
      await webhook(
        new Request(origin + "/api/ivr/record?phase=retry", {
          method: "POST",
          headers: bad.headers,
          body: await bad.text(),
        }),
      ).catch(() => "rejected"),
    ).toBe("rejected");
  });
  it("rejects a different provider account", async () =>
    expect(
      (
        await incoming(
          request("/api/ivr/incoming", { AccountSid: "AC" + "d".repeat(32) }),
        )
      ).status,
    ).toBe(403));
  it("keeps disabled service closed", async () => {
    vi.stubEnv("IVR_ENABLED", "false");
    expect(
      await (await incoming(request("/api/ivr/incoming"))).text(),
    ).toContain("not available");
    expect(configuration().configured).toBe(false);
  });
  it("limits unanswered menus", async () =>
    expect(
      await (await incoming(request("/api/ivr/incoming?attempt=3"))).text(),
    ).toContain("<Hangup/>"));
  it("offers a four-language keypad menu", async () => {
    const xml = await (await incoming(request("/api/ivr/incoming"))).text();
    expect(xml).toContain('input="dtmf"');
    expect(xml).toContain("Igbo, press 4");
  });
  it("does not silently default invalid language choices", async () => {
    const xml = await (
      await record(request("/api/ivr/record?phase=language", { Digits: "7" }))
    ).text();
    expect(xml).toContain("not recognised");
    expect(xml).not.toContain("<Record");
  });
  it.each(["1", "2", "3", "4"])(
    "requires consent for language choice %s",
    async (digit) => {
      const xml = await (
        await record(
          request("/api/ivr/record?phase=language", { Digits: digit }),
        )
      ).text();
      expect(xml).toContain("phase=consent");
      expect(xml).not.toContain("<Record");
      if (digit !== "1") expect(xml).toContain("consent.mp3");
    },
  );
  it("refuses unconfigured non-English playback", async () => {
    vi.stubEnv("IVR_TTS_LANGUAGES", "");
    const xml = await (
      await record(request("/api/ivr/record?phase=language", { Digits: "2" }))
    ).text();
    expect(xml).toContain("not ready");
    expect(xml).not.toContain("<Record");
  });
  it("ends when recording consent is declined", async () => {
    const state = stateToken(call, "en-NG", true);
    const xml = await (
      await record(
        request("/api/ivr/record?phase=consent&state=" + state, {
          Digits: "2",
        }),
      )
    ).text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Record");
  });
  it("records only after consent and queues with a status callback", async () => {
    const state = stateToken(call, "en-NG", true),
      xml = await (
        await record(
          request("/api/ivr/record?phase=consent&state=" + state, {
            Digits: "1",
          }),
        )
      ).text();
    expect(xml).toContain('playBeep="true"');
    expect(xml).toContain('finishOnKey="#"');
    expect(xml).toContain('recordingStatusCallbackEvent="completed"');
    expect(xml).toContain("/api/ivr/wait");
  });
  it("binds signed state to the caller and expiration", () => {
    const state = stateToken(call, "yo", true);
    expect(readState(state, call).language).toBe("yo");
    expect(() => readState(state, call.slice(0, -1) + "c")).toThrow();
    expect(() => readState(state + "x")).toThrow();
    vi.spyOn(Date, "now").mockReturnValueOnce(Date.now() + 21 * 60 * 1000);
    expect(() => readState(state)).toThrow();
    vi.restoreAllMocks();
  });
  it("encrypts stored health responses and detects tampering", () => {
    const sealed = encryptResult({ text: "sample-private-guidance" });
    expect(sealed).not.toContain("sample-private-guidance");
    expect(decryptResult(sealed)).toEqual({ text: "sample-private-guidance" });
    const data = Buffer.from(sealed, "base64");
    data[data.length - 1] ^= 1;
    expect(() => decryptResult(data.toString("base64"))).toThrow();
  });
  it("acknowledges a ready recording before inference", async () => {
    const state = stateToken(call, "en-NG", true);
    expect(
      (
        await processRecording(
          request("/api/ivr/process?state=" + state, {
            RecordingStatus: "completed",
            RecordingSid: recording,
          }),
        )
      ).status,
    ).toBe(204);
    expect(mocks.enqueue).toHaveBeenCalledOnce();
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.runJob).not.toHaveBeenCalled();
  });
  it("returns retryable failure when durable storage is unavailable", async () => {
    mocks.enqueue.mockRejectedValue(new Error("offline"));
    const state = stateToken(call, "en-NG", true);
    expect(
      (
        await processRecording(
          request("/api/ivr/process?state=" + state, {
            RecordingStatus: "completed",
            RecordingSid: recording,
          }),
        )
      ).status,
    ).toBe(503);
  });
  it("does not process a recording without signed consent", async () => {
    const state = stateToken(call, "en-NG");
    expect(
      (
        await processRecording(
          request("/api/ivr/process?state=" + state, {
            RecordingStatus: "completed",
            RecordingSid: recording,
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it("ignores unsafe callback recording URLs", async () => {
    const state = stateToken(call, "en-NG", true);
    await processRecording(
      request("/api/ivr/process?state=" + state, {
        RecordingStatus: "completed",
        RecordingSid: recording,
        RecordingUrl: "http://localhost/secret",
      }),
    );
    expect(mocks.enqueue.mock.calls[0][1]).toBe(recording);
  });
  it("waits in short polls instead of blocking the voice webhook", async () => {
    const state = stateToken(call, "en-NG", true),
      xml = await (await wait(request("/api/ivr/wait?state=" + state))).text();
    expect(xml).toContain('<Pause length="5"/>');
    expect(xml).toContain("round=1");
  });
  it("escapes generated text and includes replay options", async () => {
    mocks.getJob.mockResolvedValue({
      status: "ready",
      result: { text: 'help <script> & "safe"' },
    });
    const xml = await (
      await wait(
        request("/api/ivr/wait?state=" + stateToken(call, "en-NG", true)),
      )
    ).text();
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("hear the response again");
    expect(xml).not.toContain("<script>");
  });
  it("plays generated native-language audio rather than unsupported Say locales", async () => {
    mocks.getJob.mockResolvedValue({
      status: "ready",
      result: { text: "guidance", audio: "YWJj", contentType: "audio/mpeg" },
    });
    const xml = await (
      await wait(request("/api/ivr/wait?state=" + stateToken(call, "yo", true)))
    ).text();
    expect(xml).toContain("<Play>");
    expect(xml).not.toContain('language="yo-NG"');
  });
  it("hangs up instead of keeping the caller on hold indefinitely", async () => {
    const xml = await (
      await wait(
        request(
          "/api/ivr/wait?round=32&state=" + stateToken(call, "en-NG", true),
        ),
      )
    ).text();
    expect(xml).toContain("could not prepare");
    expect(xml).not.toContain("<Pause");
  });
});

describe("caller profile consent", () => {
  it("offers optional PIN history only after recording consent", async () => {
    vi.stubEnv("IVR_PROFILE_SECRET", "profile-secret".repeat(4));
    const token = stateToken(call, "en-NG");
    const xml = await (
      await record(
        request("/api/ivr/record?phase=consent&state=" + token, {
          Digits: "1",
          From: "+2348012345678",
        }),
      )
    ).text();
    expect(xml).toContain("/api/ivr/profile");
    expect(xml).not.toContain("<Record");
  });
  it("allows anonymous callers to continue without a profile", async () => {
    vi.stubEnv("IVR_PROFILE_SECRET", "profile-secret".repeat(4));
    const token = stateToken(call, "en-NG");
    const xml = await (
      await record(
        request("/api/ivr/record?phase=consent&state=" + token, {
          Digits: "1",
          From: "anonymous",
        }),
      )
    ).text();
    expect(xml).toContain("<Record");
    expect(xml).not.toContain("/api/ivr/profile");
  });
  it("retains the authorized profile and previous answer on follow-up", async () => {
    const { signState } = await import("./ivr");
    const state = readState(stateToken(call, "en-NG", true));
    state.profileId = "12345678-1234-1234-1234-123456789abc";
    const xml = await (
      await record(
        request("/api/ivr/record?phase=retry&state=" + signState(state)),
      )
    ).text();
    const token = new URL(
      xml.match(/action="([^"]+)"/)![1].replaceAll("&amp;", "&"),
    ).searchParams.get("state")!;
    const next = readState(token, call);
    expect(next.id).not.toBe(state.id);
    expect(next.profileId).toBe(state.profileId);
    expect(next.previous).toBe(state.id);
    expect(next.expires).toBe(state.expires);
  });
});
