import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("pg", () => ({ Pool: class {
  async query(sql: string, params?: unknown[]) {
    if (!params && sql.includes(";")) { const rows = await state.db.exec(sql); return { rows: rows.at(-1)?.rows || [], rowCount: 0 }; }
    const result = await state.db.query(sql, params); return { ...result, rowCount: result.rows.length };
  }
  async connect() { return { query: this.query.bind(this), release() {} }; }
} }));
import { createSessionToken } from "./session";
import { hashPassword } from "./password";
import { NatlasSpeechProvider, NatlasLLMProvider } from "./natlas";
import * as runtime from "./natlas-space";
import { AsrError } from "./asr-contract";
import { NATLAS_ASR_MODELS, speechLanguageFromUi, type IlaraLanguage } from "./languages";
import * as phone from "./phone-pilot";
import { encodeCallWav, decodeCallAudio } from "./call-audio";
import { POST as startRoute } from "@/app/api/phone/call/route";
import { POST as turnRoute } from "@/app/api/phone/call/turn/route";
import { POST as eventRoute } from "@/app/api/phone/call/event/route";

let userId: string, cookie: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test-only");
  vi.stubEnv("PHONE_INTEGRATION_KEY", "app-call-test-key-".repeat(3));
  vi.stubEnv("AUTH_SECRET", "app-call-session-test-key-".repeat(3));
  vi.stubEnv("SIM_PHONE_ENABLED", "false");
  state.db = new PGlite(); await phone.ensurePhoneSchema();
}, 20_000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await state.db.exec("TRUNCATE users CASCADE;");
  const user = await state.db.query<{ id: string }>("INSERT INTO users(phone_e164,password_hash) VALUES($1,$2) RETURNING id", ["+999000000001", await hashPassword("synthetic-test-password")]);
  userId = String(user.rows[0].id); cookie = "ileraher_session=" + await createSessionToken(userId, "+999000000001");
});
afterAll(async () => { await state.db.close(); vi.unstubAllEnvs(); });
function jsonRequest(path: string, body: unknown, signedIn = true, origin = "https://app.test") {
  return new NextRequest("https://app.test/api/phone/call" + path, { method: "POST", headers: {
    "content-type": "application/json", origin, ...(signedIn ? { cookie } : {}),
  }, body: JSON.stringify(body) });
}
async function start(language: IlaraLanguage = "en-NG") {
  const response = await startRoute(jsonRequest("", { language, consented: true }));
  expect(response.status).toBe(200); return response.json();
}
async function wav(seconds = 1, rate = 16000) {
  return encodeCallWav([new Float32Array(seconds * rate).fill(.1)], rate);
}
async function turnRequest(grant: { callId: string; grant: string }, turnId = randomUUID()) {
  const form = new FormData(); form.set("callId", grant.callId); form.set("grant", grant.grant);
  form.set("turnId", turnId); form.set("audio", await wav(), "call.wav");
  return new NextRequest("https://app.test/api/phone/call/turn", { method: "POST", headers: { cookie, origin: "https://app.test" }, body: form });
}
function mockModels() {
  const asr = vi.spyOn(NatlasSpeechProvider.prototype, "transcribe").mockImplementation(async (_audio, language = "en-NG") => ({ text: "I have mild period cramps", language: speechLanguageFromUi(language), model: NATLAS_ASR_MODELS[language], provider: "ileraher_zerogpu_asr", natlas: true }));
  const llm = vi.spyOn(NatlasLLMProvider.prototype, "answer").mockResolvedValue({ text: "Gentle warmth may help mild cramps.", model: "NCAIR1/N-ATLaS", provider: "hf-space", natlas: true });
  const tts = vi.spyOn(runtime, "synthesizeViaYarnSpace").mockImplementation(async () => Buffer.from(await (await wav()).arrayBuffer()));
  return { asr, llm, tts };
}

describe("authenticated in-app voice calling", () => {
  it("requires sign-in, same origin, supported language and recording consent", async () => {
    expect((await startRoute(jsonRequest("", { language: "en-NG", consented: true }, false))).status).toBe(401);
    expect((await startRoute(jsonRequest("", { language: "en-NG", consented: true }, true, "https://other.test"))).status).toBe(403);
    for (const body of [{ language: "yo", consented: false }, { language: "sw", consented: true }])
      expect((await startRoute(jsonRequest("", body))).status).toBe(400);
    expect((await state.db.query("SELECT id FROM phone_sessions")).rows).toHaveLength(0);
  });
  it("starts without a calling PIN or gateway, and binds the call to its signed-in owner", async () => {
    const grant = await start(), session = await phone.getAppPhoneSession(userId, grant.callId, grant.grant);
    expect(session.channel).toBe("app"); expect(grant.maxTurns).toBe(6);
    expect((await state.db.query("SELECT * FROM phone_accounts")).rows).toHaveLength(0);
    await expect(phone.getAppPhoneSession("99999", grant.callId, grant.grant)).rejects.toMatchObject({ status: 401 });
    const stored = (await state.db.query<{ grant_hash: string }>("SELECT grant_hash FROM phone_sessions")).rows[0];
    expect(stored.grant_hash).not.toBe(grant.grant);
  });
  it("replaces only the user's previous app call and rejects expired/closed grants", async () => {
    const old = await start(); await start();
    await expect(phone.getAppPhoneSession(userId, old.callId, old.grant)).rejects.toMatchObject({ status: 401 });
    const expired = await start(); await state.db.query("UPDATE phone_sessions SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.callId]);
    await expect(phone.getAppPhoneSession(userId, expired.callId, expired.grant)).rejects.toMatchObject({ status: 401 });
  });
  it.each(["en-NG", "yo", "ha", "ig"] as const)("returns verified N-ATLaS/YarnGPT audio for %s and encrypted follow-up context", async language => {
    const models = mockModels(), grant = await start(language), turnId = randomUUID();
    const response = await turnRoute(await turnRequest(grant, turnId));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    const data = await response.json(), verified = decodeCallAudio(data, language, turnId);
    expect(verified.reply.model).toBe("n-atlas"); expect(verified.audio.size).toBeGreaterThan(44);
    expect(models.asr).toHaveBeenCalledWith(expect.any(Blob), language, expect.any(AbortSignal));
    expect(models.tts).toHaveBeenCalledWith(expect.stringContaining("Gentle warmth"), language, expect.any(AbortSignal));
    const row = (await state.db.query<{ context_enc: string; reply_enc: string }>("SELECT context_enc,reply_enc FROM phone_sessions WHERE id=$1", [grant.callId])).rows[0];
    expect(row.context_enc).not.toContain("cramps"); expect(row.reply_enc).not.toContain("Gentle warmth");
    expect((await turnRoute(await turnRequest(grant, turnId))).status).toBe(409);
    expect(models.asr).toHaveBeenCalledTimes(1);
    await turnRoute(await turnRequest(grant));
    expect(models.llm).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ conversation: expect.arrayContaining([expect.objectContaining({ role: "user", content: "I have mild period cramps" })]) }), language, expect.any(AbortSignal));
  });
  it("rejects another user's grant without invoking inference", async () => {
    const models = mockModels(), grant = await start();
    const user = await state.db.query<{ id: string }>("INSERT INTO users(phone_e164,password_hash) VALUES($1,$2) RETURNING id", ["+999000000002", "test-only"]);
    cookie = "ileraher_session=" + await createSessionToken(String(user.rows[0].id), "+999000000002");
    expect((await turnRoute(await turnRequest(grant))).status).toBe(401);
    expect((await eventRoute(jsonRequest("/event", { ...grant, event: "end" }))).status).toBe(401);
    expect(models.asr).not.toHaveBeenCalled();
  });
  it("preserves provider quota deadlines and the readable answer when TTS is blocked", async () => {
    const models = mockModels(), grant = await start("yo"), retryAt = new Date(Date.now() + 3600_000).toISOString();
    models.tts.mockRejectedValue(new AsrError("ASR_QUOTA", 429, "private provider message", retryAt));
    const response = await turnRoute(await turnRequest(grant)), data = await response.json();
    expect(response.status).toBe(429); expect(data.code).toBe("TTS_QUOTA"); expect(data.retryAt).toBe(retryAt);
    expect(data.error).toContain("WAT"); expect(response.headers.get("retry-after")).not.toBeNull();
    expect(data.reply.answer).toContain("Gentle warmth"); expect(data.audio).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("private provider message");
    expect((await state.db.query<{ context_enc: string | null }>("SELECT context_enc FROM phone_sessions WHERE id=$1", [grant.callId])).rows[0].context_enc).toBeNull();
  });
  it("returns ASR quota metadata before text or speech inference", async () => {
    const models = mockModels(), grant = await start(), retryAt = new Date(Date.now() + 3600_000).toISOString();
    models.asr.mockRejectedValue(new AsrError("ASR_QUOTA", 429, "quota", retryAt));
    const response = await turnRoute(await turnRequest(grant));
    expect(response.status).toBe(429); expect(await response.json()).toMatchObject({ code: "ASR_QUOTA", retryAt });
    expect(models.llm).not.toHaveBeenCalled(); expect(models.tts).not.toHaveBeenCalled();
  });
  it("rejects invalid audio before inference and forbids integration-only events", async () => {
    const models = mockModels(), grant = await start();
    const request = await turnRequest(grant), form = await request.formData(); form.set("audio", new Blob(["invalid recording"], { type: "audio/wav" }), "bad.wav");
    const invalid = new NextRequest(request.url, { method: "POST", headers: { cookie, origin: "https://app.test" }, body: form });
    expect((await turnRoute(invalid)).status).toBe(400);
    expect((await eventRoute(jsonRequest("/event", { ...grant, event: "heartbeat", gatewayReady: true, languages: ["en-NG"] }))).status).toBe(400);
    expect(models.asr).not.toHaveBeenCalled();
  });
  it("saves only acknowledged audio when the existing saving preference is enabled, and clears context on hang-up", async () => {
    mockModels(); await phone.changePhoneAccount(userId, { password: "synthetic-test-password", pin: "492738", keepReplies: true });
    const grant = await start(), turnId = randomUUID(); await turnRoute(await turnRequest(grant, turnId));
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(0);
    expect((await eventRoute(jsonRequest("/event", { ...grant, event: "played", turnId }))).status).toBe(200);
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(1);
    expect((await eventRoute(jsonRequest("/event", { ...grant, event: "end" }))).status).toBe(200);
    const row = (await state.db.query("SELECT closed,context_enc,reply_enc FROM phone_sessions WHERE id=$1", [grant.callId])).rows[0];
    expect(row).toMatchObject({ closed: true, context_enc: null, reply_enc: null });
    expect((await turnRoute(await turnRequest(grant))).status).toBe(401);
  });
  it("does not commit a reply after hang-up during inference", async () => {
    const models = mockModels(), grant = await start();
    let resolve: (value: Awaited<ReturnType<NatlasSpeechProvider["transcribe"]>>) => void = () => {};
    models.asr.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const response = turnRoute(await turnRequest(grant));
    await vi.waitFor(() => expect(models.asr).toHaveBeenCalled());
    await eventRoute(jsonRequest("/event", { ...grant, event: "end" }));
    resolve({ text: "I have mild period cramps", language: "english", model: NATLAS_ASR_MODELS["en-NG"], provider: "ileraher_zerogpu_asr", natlas: true });
    expect((await response).status).toBe(401);
    expect((await state.db.query<{ reply_enc: string | null }>("SELECT reply_enc FROM phone_sessions WHERE id=$1", [grant.callId])).rows[0].reply_enc).toBeNull();
  });
});
