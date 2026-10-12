import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AgentCallClient, type CallSnapshot } from "./agent-call-client";
import { encodeCallWav, decodeCallAudio } from "./call-audio";
import { validatePhoneWav } from "./phone-audio";
import { NATLAS_ASR_MODELS, type IlaraLanguage } from "./languages";
import { YARN_TTS_MODEL } from "./yarn-audio";

let rms = 0, blockPlayback = false, speechModel = YARN_TTS_MODEL;
let nextError: { code: string; retryAt: string } | null = null;
let delayedTurn: Promise<Response> | null = null;
let delayedPlayed: Promise<Response> | null = null;
let language: IlaraLanguage;
const track = { enabled: true, stop: vi.fn() };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const recordings: FakeRecorder[] = [], audios: FakeAudio[] = [];
class FakeRecorder {
  static isTypeSupported() { return true; }
  state = "inactive"; mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { recordings.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["synthetic recorder fixture"]) }); this.onstop?.(); }
}
class FakeContext {
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource() { return { connect: vi.fn() }; }
  createAnalyser() { return { fftSize: 1024, getFloatTimeDomainData: (samples: Float32Array) => samples.fill(rms) }; }
  async decodeAudioData() { return { numberOfChannels: 1, sampleRate: 16000, getChannelData: () => new Float32Array(16000).fill(.1) }; }
}
class FakeAudio {
  onended: (() => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  src: string; ended = false;
  pause = vi.fn();
  play = vi.fn(async () => { if (blockPlayback) throw new Error("Mobile autoplay blocked"); });
  constructor(src: string) { this.src = src; audios.push(this); }
  async finish() { this.ended = true; await this.onended?.(); }
}
let client: AgentCallClient, snapshots: CallSnapshot[], request: ReturnType<typeof vi.fn>;
const latest = () => snapshots.at(-1)!;
async function responseAudio(turnId: string) {
  const wav = await encodeCallWav([new Float32Array(16000).fill(.1)], 16000).arrayBuffer();
  return { turnId, question: "I have mild period cramps", answer: "Gentle warmth may help.", nextSteps: [],
    disclaimer: "Consult a health professional.", sources: [], model: "n-atlas", language,
    speechModel, transcriptionModel: NATLAS_ASR_MODELS[language], contentType: "audio/wav",
    turnsRemaining: 5, audio: Buffer.from(wav).toString("base64") };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] });
  rms = 0; blockPlayback = false; speechModel = YARN_TTS_MODEL; nextError = null; delayedTurn = null; delayedPlayed = null;
  track.enabled = true; track.stop.mockClear(); recordings.length = 0; audios.length = 0; snapshots = [];
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  vi.stubGlobal("MediaRecorder", FakeRecorder); vi.stubGlobal("AudioContext", FakeContext); vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-call"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  request = vi.fn(async (url: string, init: RequestInit) => {
    if (url === "/api/phone/call") {
      language = JSON.parse(String(init.body)).language;
      return Response.json({ callId: "11111111-1111-4111-8111-111111111111", grant: "g".repeat(43), language, maxTurns: 6, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    }
    if (url.endsWith("/event")) {
      const body = JSON.parse(String(init.body));
      return body.event === "played" && delayedPlayed ? delayedPlayed : Response.json({ ok: true });
    }
    if (delayedTurn) return delayedTurn;
    if (nextError) return Response.json(nextError, { status: 429 });
    const form = init.body as FormData;
    const wav = Buffer.from(await (form.get("audio") as Blob).arrayBuffer());
    validatePhoneWav(wav, 1_000_000);
    return Response.json(await responseAudio(String(form.get("turnId"))));
  });
  vi.stubGlobal("fetch", request);
  client = new AgentCallClient(s => snapshots.push(s)); client.mount();
});
afterEach(() => { client.unmount(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function send() { client.send(); await vi.waitFor(() => expect(["speaking", "error", "paused"]).toContain(latest().phase)); }
describe("browser call lifecycle", () => {
  it.each(["en-NG", "yo", "ha", "ig"] as const)("records, receives verified audio, plays it and resumes listening for %s", async language => {
    await client.start(language); expect(latest().phase).toBe("listening");
    await send(); expect(latest().phase).toBe("speaking"); expect(latest().reply?.language).toBe(language);
    expect(track.enabled).toBe(false); expect(audios[0].play).toHaveBeenCalledOnce();
    await audios[0].finish(); expect(latest().phase).toBe("listening"); expect(track.enabled).toBe(true);
    expect(request).toHaveBeenCalledWith("/api/phone/call/event", expect.objectContaining({ body: expect.stringContaining('"event":"played"') }));
    client.hangup(); expect(latest().phase).toBe("ended"); expect(track.stop).toHaveBeenCalled();
  });
  it("hangs up during inference and ignores a late reply", async () => {
    let resolve: (response: Response) => void = () => {};
    delayedTurn = new Promise(done => { resolve = done; });
    await client.start("en-NG"); client.send();
    await vi.waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith("/turn"))).toBe(true));
    client.hangup(); const snapshotsAtEnd = snapshots.length;
    const form = request.mock.calls.find(([url]) => url.endsWith("/turn"))![1].body as FormData;
    resolve(Response.json(await responseAudio(String(form.get("turnId")))));
    await vi.advanceTimersByTimeAsync(200);
    expect(snapshots.length).toBe(snapshotsAtEnd); expect(audios).toHaveLength(0); expect(track.stop).toHaveBeenCalled();
  });
  it("stops a microphone obtained after a cancelled connection", async () => {
    let resolve: (value: MediaStream) => void = () => {};
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(done => { resolve = done; }) as Promise<MediaStream>);
    const starting = client.start("en-NG");
    await vi.waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    client.hangup(); resolve(stream as unknown as MediaStream); await starting;
    expect(track.stop).toHaveBeenCalled(); expect(request).not.toHaveBeenCalled(); expect(latest().phase).toBe("ended");
  });
  it("mutes without uploading the unfinished question and resumes on unmute", async () => {
    await client.start("yo"); client.toggleMute();
    expect(latest()).toMatchObject({ phase: "paused", muted: true }); expect(track.enabled).toBe(false);
    expect(request.mock.calls.some(([url]) => url.endsWith("/turn"))).toBe(false);
    client.toggleMute(); expect(latest()).toMatchObject({ phase: "listening", muted: false });
  });
  it("uses detected speech and silence to submit a question automatically", async () => {
    await client.start("ha"); rms = .1; await vi.advanceTimersByTimeAsync(500);
    rms = 0; await vi.advanceTimersByTimeAsync(1800);
    await vi.waitFor(() => expect(latest().phase).toBe("speaking"));
    expect(request.mock.calls.filter(([url]) => url.endsWith("/turn"))).toHaveLength(1);
  });
  it("pauses an idle microphone without transcribing silence", async () => {
    await client.start("ig"); await vi.advanceTimersByTimeAsync(15_100);
    expect(latest().phase).toBe("paused"); expect(track.enabled).toBe(false);
    expect(request.mock.calls.some(([url]) => url.endsWith("/turn"))).toBe(false);
  });
  it("lets a user play a reply after mobile autoplay is blocked without repeating inference", async () => {
    blockPlayback = true; await client.start("en-NG"); await send();
    expect(latest()).toMatchObject({ phase: "paused", pendingAudio: true });
    blockPlayback = false; await client.playPending(); expect(latest().phase).toBe("speaking");
    expect(request.mock.calls.filter(([url]) => url.endsWith("/turn"))).toHaveLength(1);
  });
  it("keeps a muted microphone off after spoken playback", async () => {
    await client.start("yo"); client.send(); client.toggleMute(); await vi.waitFor(() => expect(latest().phase).toBe("speaking"));
    await audios[0].finish(); expect(latest()).toMatchObject({ phase: "paused", muted: true }); expect(track.enabled).toBe(false);
  });
  it("waits for playback acknowledgment before recording the next question", async () => {
    let resolve: (response: Response) => void = () => {};
    delayedPlayed = new Promise(done => { resolve = done; });
    await client.start("en-NG"); await send(); const recordingCount = recordings.length;
    const finishing = audios[0].finish(); await vi.advanceTimersByTimeAsync(100);
    expect(recordings.length).toBe(recordingCount); expect(latest().phase).toBe("thinking");
    resolve(Response.json({ ok: true })); await finishing; expect(recordings.length).toBe(recordingCount + 1);
  });
  it("displays the provider retry deadline and releases the microphone on quota failure", async () => {
    nextError = { code: "ASR_QUOTA", retryAt: new Date(Date.now() + 3600_000).toISOString() };
    await client.start("en-NG"); await send();
    expect(latest()).toMatchObject({ phase: "error", active: false, error: "asrQuota", retryAt: nextError.retryAt });
    expect(audios).toHaveLength(0); expect(track.stop).toHaveBeenCalled();
  });
  it("rejects substitute speech rather than playing it", async () => {
    speechModel = "browser-voice"; await client.start("en-NG"); await send();
    expect(latest()).toMatchObject({ phase: "error", active: false }); expect(audios).toHaveLength(0);
  });
  it("expires the call and stops all microphone tracks", async () => {
    await client.start("en-NG"); await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(latest()).toMatchObject({ phase: "ended", active: false }); expect(track.stop).toHaveBeenCalled();
  });
});
describe("bounded and verified call audio", () => {
  it("downsamples stereo to mono 16 kHz and caps the encoded recording at 30 seconds", async () => {
    const left = new Float32Array(48000 * 31).fill(.5), right = new Float32Array(left.length).fill(-.5);
    const wav = Buffer.from(await encodeCallWav([left, right], 48000).arrayBuffer());
    validatePhoneWav(wav, 1_000_000);
    expect(wav.length).toBe(960044); expect(wav.readUInt32LE(24)).toBe(16000); expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readInt16LE(44)).toBe(0);
  });
  it("rejects wrong-language and wrong-turn audio before playback", async () => {
    language = "en-NG"; const data = await responseAudio("turn-1");
    expect(() => decodeCallAudio(data, "yo", "turn-1")).toThrow(); expect(() => decodeCallAudio(data, "en-NG", "turn-2")).toThrow();
  });
});
