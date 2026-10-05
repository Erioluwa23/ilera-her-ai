import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { database, schema } from "./ivr-jobs";
import type { CallState } from "./ivr";
function key() {
  const secret = process.env.IVR_PROFILE_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Caller history unavailable");
  return secret;
}
export function historyEnabled(language: string) {
  return (
    (process.env.IVR_PROFILE_SECRET?.length || 0) >= 32 &&
    (language === "en-NG" ||
      (process.env.IVR_HISTORY_PROMPT_LANGUAGES || "")
        .split(",")
        .includes(language))
  );
}
export function callerKey(phone: string) {
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return undefined;
  return createHmac("sha256", key())
    .update("caller:" + phone)
    .digest("hex");
}
export function sealHistory(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256").update(key()).digest(),
      iv,
    );
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function openHistory<T>(value: string): T {
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      createHash("sha256").update(key()).digest(),
      data.subarray(0, 12),
    );
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
}
export async function profileExists(hash: string) {
  await schema();
  const result = await database().query(
    "SELECT id FROM ileraher_ivr_profiles WHERE phone_hash=$1 AND expires_at>now()",
    [hash],
  );
  return !!result.rows[0];
}
export async function unlockProfile(
  hash: string,
  pin: string,
  create: boolean,
) {
  if (!/^\d{6}$/.test(pin)) return null;
  await schema();
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM ileraher_ivr_profiles WHERE expires_at<now()",
    );
    if (create) {
      const salt = randomBytes(16).toString("hex");
      await client.query(
        "INSERT INTO ileraher_ivr_profiles(id,phone_hash,salt,pin_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days') ON CONFLICT(phone_hash) DO NOTHING",
        [randomUUID(), hash, salt, scryptSync(pin, salt, 32).toString("hex")],
      );
    }
    const result = await client.query(
      "SELECT * FROM ileraher_ivr_profiles WHERE phone_hash=$1 FOR UPDATE",
      [hash],
    );
    const row = result.rows[0];
    if (
      !row ||
      (row.locked_until && new Date(row.locked_until).getTime() > Date.now())
    ) {
      await client.query("COMMIT");
      return null;
    }
    const valid = timingSafeEqual(
      scryptSync(pin, row.salt, 32),
      Buffer.from(row.pin_hash, "hex"),
    );
    if (!valid) {
      await client.query(
        "UPDATE ileraher_ivr_profiles SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=$1",
        [row.id],
      );
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      "UPDATE ileraher_ivr_profiles SET failures=0,locked_until=NULL,expires_at=now()+interval '30 days' WHERE id=$1",
      [row.id],
    );
    await client.query("COMMIT");
    return row.id as string;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export type HistoryTurn = {
  question: string;
  answer: string;
  language: string;
  recordedAt: string;
};
export async function callerHistory(state: CallState): Promise<HistoryTurn[]> {
  if (!state.profileId) return [];
  await schema();
  const result = await database().query(
    "SELECT h.payload FROM ileraher_ivr_history h JOIN ileraher_ivr_profiles p ON p.id=h.profile_id WHERE p.id=$1 AND p.expires_at>now() AND h.created_at>now()-interval '30 days' ORDER BY h.created_at DESC LIMIT 4",
    [state.profileId],
  );
  return result.rows
    .reverse()
    .map((row) => openHistory<HistoryTurn>(row.payload));
}
export async function forgetProfile(state: CallState) {
  if (!state.profileId) return;
  await schema();
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT id FROM ileraher_ivr_profiles WHERE id=$1 FOR UPDATE",
      [state.profileId],
    );
    await client.query("DELETE FROM ileraher_ivr_jobs WHERE profile_id=$1", [
      state.profileId,
    ]);
    await client.query("DELETE FROM ileraher_ivr_profiles WHERE id=$1", [
      state.profileId,
    ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
