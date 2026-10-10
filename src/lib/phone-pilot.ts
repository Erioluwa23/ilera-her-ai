import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ensureAuthSchema, getDb } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { normalizePhone } from "./phone";
import type { IlaraLanguage } from "./languages";
import type { ConversationTurn } from "./voice-chat";

export class PhoneError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const PHONE_LANGUAGES: IlaraLanguage[] = ["en-NG", "yo", "ha", "ig"];
export const CALL_LIFETIME_SECONDS = 15 * 60;
export const MAX_CALL_TURNS = 6;
export const MAX_CALL_AUDIO_BYTES = 500_000;
let schemaReady: Promise<void> | null = null;

export function integrationKey() {
  const key = process.env.PHONE_INTEGRATION_KEY;
  if (!key || key.length < 32) throw new PhoneError(503, "Phone integration is not configured.");
  return key;
}
export function requirePhoneIntegration(req: Request, active = true) {
  const expected = Buffer.from("Bearer " + integrationKey());
  const actual = Buffer.from(req.headers.get("authorization") || "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new PhoneError(401, "Integration authentication failed.");
  if (active && process.env.SIM_PHONE_ENABLED !== "true") throw new PhoneError(503, "Phone pilot is paused.");
}
export function requireSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.RENDER_EXTERNAL_URL || req.url).origin;
  if ((origin && origin !== expected) || req.headers.get("sec-fetch-site") === "cross-site")
    throw new PhoneError(403, "Request not allowed.");
}
export async function readPhoneBody(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new PhoneError(400, "Missing request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);
  const abort = () => { void reader.cancel(); };
  deadline.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (deadline.aborted) throw new PhoneError(408, "Upload timed out.");
      const item = await reader.read();
      if (deadline.aborted) throw new PhoneError(408, "Upload timed out.");
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new PhoneError(413, "Request too large."); }
      chunks.push(item.value);
    }
    return Buffer.concat(chunks);
  } finally { deadline.removeEventListener("abort", abort); reader.releaseLock(); }
}
export async function phoneJson(req: Request): Promise<Record<string, unknown>> {
  try {
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new Error();
    const body = JSON.parse((await readPhoneBody(req, 8192)).toString());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch (e) { if (e instanceof PhoneError) throw e; throw new PhoneError(400, "Invalid request."); }
}
export function phoneResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}
export function phoneFailure(error: unknown) {
  return phoneResponse({ error: error instanceof PhoneError ? error.message : "Phone service is temporarily unavailable." }, error instanceof PhoneError ? error.status : 503);
}
export function validCallId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function sealPhone(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update("sim-call:" + integrationKey()).digest(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function openPhone<T>(value: string): T {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update("sim-call:" + integrationKey()).digest(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
}
export function ensurePhoneSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await ensureAuthSchema();
    await getDb().query(`
      CREATE TABLE IF NOT EXISTS phone_accounts (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        pin_hash TEXT NOT NULL, keep_replies BOOLEAN NOT NULL DEFAULT false,
        failures INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS phone_sessions (
        id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grant_hash TEXT UNIQUE NOT NULL, language TEXT NOT NULL,
        context_enc TEXT, turns INTEGER NOT NULL DEFAULT 0,
        processing_until TIMESTAMPTZ, turn_id UUID, reply_enc TEXT,
        played BOOLEAN NOT NULL DEFAULT false, feedback_id BIGINT REFERENCES feedback(id) ON DELETE SET NULL,
        closed BOOLEAN NOT NULL DEFAULT false, expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS phone_replies (
        id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payload_enc TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
      );
      CREATE INDEX IF NOT EXISTS phone_replies_user ON phone_replies(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS phone_sessions_expiry ON phone_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS phone_gateway_status (
        id INTEGER PRIMARY KEY CHECK (id=1), gateway_ready BOOLEAN NOT NULL,
        languages JSONB NOT NULL, checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  })().catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}
export async function cleanPhoneData() {
  await ensurePhoneSchema();
  await getDb().query("DELETE FROM phone_sessions WHERE expires_at < now(); DELETE FROM phone_replies WHERE expires_at < now();");
}
export async function phoneAccount(userId: string) {
  await cleanPhoneData();
  const account = await getDb().query("SELECT keep_replies,locked_until FROM phone_accounts WHERE user_id=$1", [userId]);
  const replies = await getDb().query("SELECT id,payload_enc,created_at FROM phone_replies WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 20", [userId]);
  return {
    enrolled: !!account.rows[0], keepReplies: account.rows[0]?.keep_replies || false,
    replies: replies.rows.map(row => ({ id: row.id, createdAt: row.created_at, ...openPhone<Record<string, unknown>>(row.payload_enc) })),
  };
}
export async function changePhoneAccount(userId: string, body: Record<string, unknown>, remove = false) {
  await ensurePhoneSchema();
  if (typeof body.password !== "string" || body.password.length > 128) throw new PhoneError(400, "Enter your account password.");
  const user = await getDb().query("SELECT password_hash FROM users WHERE id=$1", [userId]);
  if (!user.rows[0] || !await verifyPassword(body.password, user.rows[0].password_hash)) throw new PhoneError(401, "Account password is incorrect.");
  if (!remove && (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin) || /^(\d)\1{5}$|^012345$|^123456$|^654321$/.test(body.pin)))
    throw new PhoneError(400, "Choose a six digit PIN that is not repeated or sequential.");
  if (!remove && typeof body.keepReplies !== "boolean") throw new PhoneError(400, "Choose whether to save call replies.");
  const pinHash = remove ? "" : await hashPassword(body.pin as string);
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    // Serialize against in-flight reply commits, PIN checks and revocation.
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (remove) await client.query("DELETE FROM phone_accounts WHERE user_id=$1", [userId]);
    else await client.query(`INSERT INTO phone_accounts(user_id,pin_hash,keep_replies) VALUES($1,$2,$3)
      ON CONFLICT(user_id) DO UPDATE SET pin_hash=$2,keep_replies=$3,failures=0,locked_until=NULL,updated_at=now()`, [userId, pinHash, body.keepReplies]);
    await client.query("DELETE FROM phone_sessions WHERE user_id=$1", [userId]);
    if (remove || !body.keepReplies) await client.query("DELETE FROM phone_replies WHERE user_id=$1", [userId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export async function authenticatePhone(body: Record<string, unknown>) {
  if (!validCallId(body.callId) || typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin) ||
    typeof body.phone !== "string" || body.phone.length > 32 || body.consented !== true || !PHONE_LANGUAGES.includes(body.language as IlaraLanguage))
    throw new PhoneError(400, "Invalid call authentication request.");
  let phone: string;
  try { phone = normalizePhone(body.phone); } catch { throw new PhoneError(401, "Phone number or calling PIN is incorrect, or calling is locked."); }
  await cleanPhoneData();
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT id FROM users WHERE phone_e164=$1 FOR UPDATE", [phone]);
    const account = user.rows[0] ? await client.query("SELECT * FROM phone_accounts WHERE user_id=$1 FOR UPDATE", [user.rows[0].id]) : { rows: [] };
    const row = account.rows[0];
    if (!row || (row.locked_until && new Date(row.locked_until).getTime() > Date.now())) {
      await client.query("COMMIT");
      throw new PhoneError(401, "Phone number or calling PIN is incorrect, or calling is locked.");
    }
    if (!await verifyPassword(body.pin, row.pin_hash)) {
      await client.query(`UPDATE phone_accounts SET failures=CASE WHEN locked_until<=now() THEN 1 ELSE failures+1 END,
        locked_until=CASE WHEN locked_until<=now() THEN NULL WHEN failures+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=$1`, [row.user_id]);
      await client.query("COMMIT");
      throw new PhoneError(401, "Phone number or calling PIN is incorrect, or calling is locked.");
    }
    await client.query("UPDATE phone_accounts SET failures=0,locked_until=NULL WHERE user_id=$1", [row.user_id]);
    const grant = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CALL_LIFETIME_SECONDS * 1000);
    const inserted = await client.query(`INSERT INTO phone_sessions(id,user_id,grant_hash,language,expires_at) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO NOTHING RETURNING id`, [body.callId, row.user_id, tokenHash(grant), body.language, expiresAt]);
    if (!inserted.rows[0]) throw new PhoneError(409, "Call already authenticated.");
    await client.query("COMMIT");
    return { grant, callId: body.callId, language: body.language, expiresAt: expiresAt.toISOString(), maxTurns: MAX_CALL_TURNS };
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export type PhoneSession = { id: string; user_id: string; language: IlaraLanguage; context_enc: string | null; turns: number; turn_id: string | null; reply_enc: string | null; played: boolean };
export async function getPhoneSession(callId: unknown, grant: unknown): Promise<PhoneSession> {
  if (!validCallId(callId) || typeof grant !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(grant)) throw new PhoneError(401, "Call is not authenticated.");
  await ensurePhoneSchema();
  const result = await getDb().query(`SELECT s.* FROM phone_sessions s JOIN phone_accounts a ON a.user_id=s.user_id
    WHERE s.id=$1 AND s.grant_hash=$2 AND s.expires_at>now() AND NOT s.closed`, [callId, tokenHash(grant)]);
  if (!result.rows[0]) throw new PhoneError(401, "Call has ended or calling access has changed.");
  return result.rows[0];
}
export async function beginPhoneTurn(session: PhoneSession, turnId: string) {
  // No automatic replay of a turn: retrying network requests cannot duplicate inference or saved replies.
  const result = await getDb().query(`UPDATE phone_sessions SET processing_until=now()+interval '3 minutes',turn_id=$2,reply_enc=NULL,played=false
    WHERE id=$1 AND expires_at>now() AND NOT closed AND turns<$3 AND (turn_id IS NULL OR turn_id<>$2)
    AND (processing_until IS NULL OR processing_until<now()) RETURNING id`, [session.id, turnId, MAX_CALL_TURNS]);
  if (!result.rows[0]) throw new PhoneError(409, "Call turn is busy, repeated, or the question limit was reached.");
}
export async function releasePhoneTurn(session: PhoneSession, turnId: string) {
  await getDb().query("UPDATE phone_sessions SET processing_until=NULL WHERE id=$1 AND turn_id=$2", [session.id, turnId]);
}
export async function finishPhoneTurn(session: PhoneSession, turnId: string, question: string, reply: Record<string, unknown>) {
  const conversation = session.context_enc ? openPhone<ConversationTurn[]>(session.context_enc) : [];
  const next = [...conversation, { role: "user", content: question.slice(0, 800) }, { role: "assistant", content: String(reply.answer).slice(0, 800) }].slice(-8);
  const result = await getDb().query(`UPDATE phone_sessions SET context_enc=$3,reply_enc=$4,turns=turns+1,processing_until=NULL
    WHERE id=$1 AND turn_id=$2 AND NOT closed AND expires_at>now() AND EXISTS(SELECT 1 FROM phone_accounts a WHERE a.user_id=phone_sessions.user_id) RETURNING id`,
  [session.id, turnId, sealPhone(next), sealPhone({ question, ...reply })]);
  if (!result.rows[0]) throw new PhoneError(401, "Call access expired before the reply was ready.");
}
export async function phoneEvent(body: Record<string, unknown>) {
  if (body.event === "maintenance") { await cleanPhoneData(); return { ok: true }; }
  if (body.event === "heartbeat") {
    if (typeof body.gatewayReady !== "boolean" || !Array.isArray(body.languages) ||
      body.languages.length > 4 || body.languages.some(l => !PHONE_LANGUAGES.includes(l))) throw new PhoneError(400, "Invalid gateway status.");
    await cleanPhoneData();
    await getDb().query(`INSERT INTO phone_gateway_status(id,gateway_ready,languages) VALUES(1,$1,$2::jsonb)
      ON CONFLICT(id) DO UPDATE SET gateway_ready=$1,languages=$2::jsonb,checked_at=now()`, [body.gatewayReady, JSON.stringify(body.languages)]);
    return { ok: true };
  }
  const session = await getPhoneSession(body.callId, body.grant);
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [session.user_id]);
    const locked = await client.query("SELECT * FROM phone_sessions WHERE id=$1 AND NOT closed AND expires_at>now() FOR UPDATE", [session.id]);
    const row = locked.rows[0];
    if (!row) throw new PhoneError(401, "Call has ended.");
    if (body.event === "played") {
      if (body.turnId !== row.turn_id || !row.reply_enc) throw new PhoneError(409, "Reply is not available.");
      await client.query("UPDATE phone_sessions SET played=true WHERE id=$1", [session.id]);
      await client.query(`INSERT INTO phone_replies(id,user_id,payload_enc) SELECT $1,$2,$3 FROM phone_accounts
        WHERE user_id=$2 AND keep_replies ON CONFLICT(id) DO NOTHING`, [row.turn_id, session.user_id, row.reply_enc]);
    } else if (body.event === "feedback") {
      if (!row.played || !Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5)
        throw new PhoneError(400, "Rate a completed reply from 1 to 5.");
      if (!row.feedback_id) {
        const saved = await client.query("INSERT INTO feedback(user_id,rating,category,message) VALUES($1,$2,'voice','SIM phone call rating') RETURNING id", [session.user_id, body.rating]);
        await client.query("UPDATE phone_sessions SET feedback_id=$2 WHERE id=$1", [session.id, saved.rows[0].id]);
      }
    } else if (body.event === "end") {
      await client.query("UPDATE phone_sessions SET closed=true,context_enc=NULL,reply_enc=NULL,processing_until=NULL WHERE id=$1", [session.id]);
    } else throw new PhoneError(400, "Unknown call event.");
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
