import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("pg", () => ({ Pool: class {
  async query(sql: string, params?: unknown[]) {
    if (!params && sql.includes(";")) { const rows = await state.db.exec(sql); return { rows: rows.at(-1)?.rows || [], rowCount: 0 }; }
    const result = await state.db.query(sql, params); return { ...result, rowCount: result.rows.length };
  }
  async connect() { return { query: this.query.bind(this), release() {} }; }
} }));
import { hashPassword } from "./password";
import * as phone from "./phone-pilot";
import { validatePhoneWav } from "./phone-audio";
import { randomUUID } from "node:crypto";
import { NatlasSpeechProvider, NatlasLLMProvider } from "./natlas";
import * as natlasSpace from "./natlas-space";
import { POST as authenticateRoute } from "@/app/api/phone/integration/authenticate/route";
import { POST as turnRoute } from "@/app/api/phone/integration/turn/route";
import { POST as eventRoute } from "@/app/api/phone/integration/event/route";
import { NATLAS_ASR_MODELS, speechLanguageFromUi } from "./languages";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let userId: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test-only");
  vi.stubEnv("PHONE_INTEGRATION_KEY", "integration-test-key-".repeat(3));
  vi.stubEnv("SIM_PHONE_ENABLED", "true");
  state.db = new PGlite();
  await phone.ensurePhoneSchema();
}, 20000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await state.db.exec("TRUNCATE users CASCADE; TRUNCATE phone_gateway_status;");
  const user = await state.db.query<{ id: string }>("INSERT INTO users(phone_e164,password_hash) VALUES($1,$2) RETURNING id", ["+2348012345678", await hashPassword("account-password")]);
  userId = String(user.rows[0].id);
});
afterAll(async () => { await state.db.close(); vi.unstubAllEnvs(); });
async function enrol(keepReplies = true) {
  await phone.changePhoneAccount(userId, { password: "account-password", pin: "492738", keepReplies });
}
async function auth(callId: string = randomUUID(), pin = "492738") {
  return phone.authenticatePhone({ callId, phone: "08012345678", pin, language: "en-NG", consented: true });
}
async function reply(session: phone.PhoneSession, turnId: string) {
  await phone.beginPhoneTurn(session, turnId);
  await phone.finishPhoneTurn(session, turnId, "I have cramps", { answer: "Use gentle heat.", model: "curated", language: "en-NG" });
}
function wavFixture() {
  const wav = Buffer.alloc(44 + 16000); wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
  return wav;
}
function mockAi() {
  vi.spyOn(NatlasSpeechProvider.prototype, "transcribe").mockImplementation(async (_audio, language = "en-NG") => ({ text: "I have period cramps", language: speechLanguageFromUi(language), model: NATLAS_ASR_MODELS[language], provider: "ileraher_zerogpu_asr", natlas: true }));
  vi.spyOn(NatlasLLMProvider.prototype, "answer").mockRejectedValue(new Error("Fixture: N-ATLAS generation unavailable"));
  vi.spyOn(natlasSpace, "synthesizeViaYarnSpace").mockResolvedValue(wavFixture());
}
describe("registered SIM caller integration against PostgreSQL", () => {
  it("requires the account password to enrol, and never stores a plaintext PIN", async () => {
    await expect(phone.changePhoneAccount(userId, { password: "incorrect", pin: "492738", keepReplies: false })).rejects.toMatchObject({ status: 401 });
    await enrol();
    const rows = await state.db.query<{ pin_hash: string }>("SELECT pin_hash FROM phone_accounts");
    expect(rows.rows[0].pin_hash).not.toContain("492738");
  });
  it("does not admit an unregistered phone or a user who has not enrolled", async () => {
    await expect(auth()).rejects.toMatchObject({ status: 401 });
    await enrol();
    await expect(phone.authenticatePhone({ callId: randomUUID(), phone: "+2348098765432", pin: "492738", language: "en-NG", consented: true })).rejects.toMatchObject({ status: 401 });
  });
  it("locks wrong PIN attempts across different calls, and unlocks after the lock expires", async () => {
    await enrol();
    for (let i = 0; i < 5; i++) await expect(auth(randomUUID(), "492739")).rejects.toMatchObject({ status: 401 });
    await expect(auth()).rejects.toMatchObject({ status: 401 });
    await state.db.query("UPDATE phone_accounts SET locked_until=now()-interval '1 second'");
    expect((await auth()).grant).toHaveLength(43);
  });
  it("requires consent and binds the grant to its call, with no duplicate authentication", async () => {
    await enrol(); const grant = await auth();
    await expect(phone.getPhoneSession(randomUUID(), grant.grant)).rejects.toMatchObject({ status: 401 });
    await expect(auth(grant.callId)).rejects.toMatchObject({ status: 409 });
    await expect(phone.authenticatePhone({ callId: randomUUID(), phone: "08012345678", pin: "492738", language: "en-NG", consented: false })).rejects.toMatchObject({ status: 400 });
  });
  it("saves only acknowledged playback, encrypts health data, and deduplicates ratings", async () => {
    await enrol(); const grant = await auth(), session = await phone.getPhoneSession(grant.callId, grant.grant), turnId = randomUUID();
    await reply(session, turnId);
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(0);
    const stored = await state.db.query<{ reply_enc: string }>("SELECT reply_enc FROM phone_sessions");
    expect(stored.rows[0].reply_enc).not.toContain("cramps");
    const event = { callId: grant.callId, grant: grant.grant };
    await phone.phoneEvent({ ...event, event: "played", turnId });
    await phone.phoneEvent({ ...event, event: "played", turnId });
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(1);
    await phone.phoneEvent({ ...event, event: "feedback", rating: 5 });
    await phone.phoneEvent({ ...event, event: "feedback", rating: 5 });
    expect((await state.db.query("SELECT * FROM feedback")).rows).toHaveLength(1);
    await phone.phoneEvent({ ...event, event: "end" });
    await expect(phone.getPhoneSession(grant.callId, grant.grant)).rejects.toMatchObject({ status: 401 });
    expect((await state.db.query<{ context_enc: null }>("SELECT context_enc FROM phone_sessions")).rows[0].context_enc).toBeNull();
  });
  it("never saves call replies when the user opted out", async () => {
    await enrol(false); const grant = await auth(), session = await phone.getPhoneSession(grant.callId, grant.grant), turnId = randomUUID();
    await reply(session, turnId);
    await phone.phoneEvent({ event: "played", callId: grant.callId, grant: grant.grant, turnId });
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(0);
  });
  it("revokes in-flight calls and deletes saved replies when calling is disabled", async () => {
    await enrol(); const grant = await auth(), session = await phone.getPhoneSession(grant.callId, grant.grant), turnId = randomUUID();
    await phone.beginPhoneTurn(session, turnId);
    await phone.changePhoneAccount(userId, { password: "account-password" }, true);
    await expect(phone.finishPhoneTurn(session, turnId, "cramps", { answer: "reply" })).rejects.toMatchObject({ status: 401 });
    await expect(phone.getPhoneSession(grant.callId, grant.grant)).rejects.toMatchObject({ status: 401 });
    expect((await phone.phoneAccount(userId)).enrolled).toBe(false);
  });
  it("rejects simultaneous or duplicate turns and enforces the six-question limit", async () => {
    await enrol(); const grant = await auth(), session = await phone.getPhoneSession(grant.callId, grant.grant), id = randomUUID();
    await phone.beginPhoneTurn(session, id);
    await expect(phone.beginPhoneTurn(session, randomUUID())).rejects.toMatchObject({ status: 409 });
    await phone.releasePhoneTurn(session, id);
    await expect(phone.beginPhoneTurn(session, id)).rejects.toMatchObject({ status: 409 });
    await state.db.query("UPDATE phone_sessions SET turns=6");
    await expect(phone.beginPhoneTurn(session, randomUUID())).rejects.toMatchObject({ status: 409 });
  });
  it("deletes expired call contexts and expired retained replies", async () => {
    await enrol(); const grant = await auth(), session = await phone.getPhoneSession(grant.callId, grant.grant), turnId = randomUUID();
    await reply(session, turnId);
    await phone.phoneEvent({ event: "played", callId: grant.callId, grant: grant.grant, turnId });
    await state.db.query("UPDATE phone_sessions SET expires_at=now()-interval '1 second'");
    await state.db.query("UPDATE phone_replies SET expires_at=now()-interval '1 second'");
    await phone.cleanPhoneData();
    expect((await state.db.query("SELECT * FROM phone_sessions")).rows).toHaveLength(0);
    expect((await state.db.query("SELECT * FROM phone_replies")).rows).toHaveLength(0);
  });
  it("requires service credentials and blocks cross-site PIN changes", () => {
    expect(() => phone.requirePhoneIntegration(new Request("https://app"))).toThrow();
    expect(() => phone.requirePhoneIntegration(new Request("https://app", { headers: { Authorization: "Bearer " + process.env.PHONE_INTEGRATION_KEY } }))).not.toThrow();
    expect(() => phone.requireSameOrigin(new Request("https://app", { headers: { origin: "https://other" } }))).toThrow();
    const sealed = phone.sealPhone({ message: "private" });
    expect(phone.openPhone(sealed)).toEqual({ message: "private" });
    expect(() => phone.openPhone(sealed.slice(0, -5) + "abcde")).toThrow();
  });
  it("bounds streamed input even without Content-Length", async () => {
    const request = new Request("https://app", { method: "POST", body: "x".repeat(9000) });
    await expect(phone.readPhoneBody(request, 8192)).rejects.toMatchObject({ status: 413 });
  });
  it("validates the actual WAV codec and duration", () => {
    const wav = Buffer.alloc(44 + 16000); wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
    expect(() => validatePhoneWav(wav)).not.toThrow();
    wav.writeUInt16LE(2, 22); expect(() => validatePhoneWav(wav)).toThrow();
    expect(() => validatePhoneWav(Buffer.from("RIFFnot-audio"))).toThrow();
  });
  it.each(phone.PHONE_LANGUAGES)("uses existing answer and speech providers in %s and acknowledges only played replies", async language => {
    await enrol(); mockAi();
    const authenticated = await authenticateRoute(new Request("https://app/api/phone/integration/authenticate", { method: "POST", headers: { Authorization: "Bearer " + process.env.PHONE_INTEGRATION_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ callId: randomUUID(), phone: "08012345678", pin: "492738", language, consented: true }) }));
    expect(authenticated.status).toBe(200);
    const grant = await authenticated.json(), data = new FormData();
    data.set("callId", grant.callId); data.set("grant", grant.grant); data.set("turnId", randomUUID());
    data.set("audio", new Blob([new Uint8Array(wavFixture())], { type: "audio/wav" }), "question.wav");
    const response = await turnRoute(new Request("https://app/api/phone/integration/turn", { method: "POST", headers: { Authorization: "Bearer " + process.env.PHONE_INTEGRATION_KEY }, body: data }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.language).toBe(language); expect(result.transcriptionModel).toBe(NATLAS_ASR_MODELS[language]);
    expect(result.model).toBe("curated"); expect(result.audio).toBeTruthy(); expect(result.natlasError).toBeUndefined();
    expect(natlasSpace.synthesizeViaYarnSpace).toHaveBeenCalledWith(expect.any(String), language, expect.any(AbortSignal));
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(0);
    await phone.phoneEvent({ event: "played", callId: grant.callId, grant: grant.grant, turnId: result.turnId });
    expect((await phone.phoneAccount(userId)).replies).toHaveLength(1);
  });
  it("never produces or saves a successful spoken reply when synthesis fails", async () => {
    await enrol(); mockAi(); vi.spyOn(natlasSpace, "synthesizeViaYarnSpace").mockRejectedValue(new Error("Fixture quota failure"));
    const grant = await auth(), data = new FormData();
    data.set("callId", grant.callId); data.set("grant", grant.grant); data.set("turnId", randomUUID()); data.set("audio", new Blob([new Uint8Array(wavFixture())]), "question.wav");
    const response = await turnRoute(new Request("https://app/api/phone/integration/turn", { method: "POST", headers: { Authorization: "Bearer " + process.env.PHONE_INTEGRATION_KEY }, body: data }));
    expect(response.status).toBe(503); expect((await phone.phoneAccount(userId)).replies).toHaveLength(0);
  });
  it.skipIf(!process.env.SIM_TEST_PYTHON)("exercises Python SIM API through the real TypeScript app adapter and PostgreSQL", async () => {
    await enrol(); mockAi();
    const routes: Record<string, (req: Request) => Promise<Response>> = { authenticate: authenticateRoute, turn: turnRoute, event: eventRoute };
    const server = createServer(async (incoming, outgoing) => {
      try {
        const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const request = new Request("http://127.0.0.1" + incoming.url, { method: incoming.method, headers: incoming.headers as Record<string, string>, body: new Uint8Array(Buffer.concat(chunks)) });
        const response = await routes[incoming.url!.split("/").at(-1)!](request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries())); outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch { outgoing.writeHead(500); outgoing.end(); }
    });
    const media = await mkdtemp(join(tmpdir(), "sim-call-test-"));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address() as { port: number };
      const result = await promisify(execFile)(process.env.SIM_TEST_PYTHON!, ["tests/cross_runtime.py"], { cwd: join(process.cwd(), "services/ileraher-sim-call"), env: { ...process.env, PYTHONPATH: ".", SIM_TEST_APP_URL: `http://127.0.0.1:${address.port}`, SIM_TEST_KEY: process.env.PHONE_INTEGRATION_KEY!, SIM_TEST_MEDIA: media } });
      expect(result.stdout).toContain("PASS:");
      expect((await phone.phoneAccount(userId)).replies).toHaveLength(1);
      expect((await state.db.query("SELECT * FROM feedback")).rows).toHaveLength(1);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); await rm(media, { recursive: true }); }
  }, 30000);
});
