import { sealHistory } from "./ivr-profiles";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { callHash, encryptResult, decryptResult, type CallState } from "./ivr";
let pool: Pool | undefined, prepared: Promise<void> | undefined;
export function database() {
  if (!process.env.IVR_DATABASE_URL)
    throw new Error("IVR database not configured");
  return (pool ??= new Pool({
    connectionString: process.env.IVR_DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 3000,
    query_timeout: 4000,
  }));
}
export async function schema() {
  if (!prepared)
    prepared = (async () => {
      await database().query(
        `CREATE TABLE IF NOT EXISTS ileraher_ivr_jobs (id uuid PRIMARY KEY, call_hash text NOT NULL, language text NOT NULL, recording_sid text NOT NULL, expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, lease_id uuid, result text)`,
      );
      await database()
        .query(`CREATE TABLE IF NOT EXISTS ileraher_ivr_profiles (id uuid PRIMARY KEY, phone_hash text UNIQUE NOT NULL, salt text NOT NULL, pin_hash text NOT NULL, failures integer NOT NULL DEFAULT 0, locked_until timestamptz, expires_at timestamptz NOT NULL);
        CREATE TABLE IF NOT EXISTS ileraher_ivr_history (id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES ileraher_ivr_profiles(id) ON DELETE CASCADE, payload text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
        ALTER TABLE ileraher_ivr_jobs ADD COLUMN IF NOT EXISTS profile_id uuid;
        CREATE INDEX IF NOT EXISTS ileraher_ivr_history_profile ON ileraher_ivr_history(profile_id,created_at);
        DELETE FROM ileraher_ivr_profiles WHERE expires_at<now();
        DELETE FROM ileraher_ivr_history WHERE created_at<now()-interval '30 days';`);
    })();
  try {
    await prepared;
  } catch (e) {
    prepared = undefined;
    throw e;
  }
}
export async function databaseReady() {
  try {
    await schema();
    return true;
  } catch {
    return false;
  }
}
export async function enqueue(state: CallState, recording: string) {
  await schema();
  await database().query(
    "DELETE FROM ileraher_ivr_jobs WHERE expires_at < now()",
  );
  await database().query(
    "INSERT INTO ileraher_ivr_jobs (id,call_hash,language,recording_sid,expires_at,profile_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
    [
      state.id,
      callHash(state.call),
      state.language,
      recording,
      new Date(state.expires),
      state.profileId || null,
    ],
  );
}
export async function claim(state: CallState) {
  await schema();
  const id = randomUUID();
  const data = await database().query(
    "UPDATE ileraher_ivr_jobs SET status='processing',attempts=attempts+1,lease_until=now()+interval '150 seconds',lease_id=$3 WHERE id=$1 AND call_hash=$2 AND expires_at>now() AND attempts<2 AND (status='queued' OR (status='processing' AND lease_until<now())) RETURNING recording_sid",
    [state.id, callHash(state.call), id],
  );
  return data.rows[0]
    ? { recording: data.rows[0].recording_sid as string, lease: id }
    : null;
}
export type JobResult = {
  text: string;
  question?: string;
  reported?: string[];
  audio?: string;
  contentType?: string;
};
export async function finish(
  state: CallState,
  lease: string,
  result: JobResult | null,
) {
  await schema();
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    if (state.profileId) {
      const profile = await client.query(
        "SELECT id FROM ileraher_ivr_profiles WHERE id=$1 AND expires_at>now() FOR UPDATE",
        [state.profileId],
      );
      if (!profile.rows[0]) {
        await client.query("ROLLBACK");
        return;
      }
    }
    const updated = await client.query(
      "UPDATE ileraher_ivr_jobs SET status=$3,result=$4,lease_until=NULL WHERE id=$1 AND lease_id=$2 AND status='processing' AND expires_at>now() RETURNING id",
      [
        state.id,
        lease,
        result ? "ready" : "failed",
        result ? encryptResult(result) : null,
      ],
    );
    if (updated.rows[0] && result?.question && state.profileId) {
      await client.query(
        "INSERT INTO ileraher_ivr_history(id,profile_id,payload) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [
          state.id,
          state.profileId,
          sealHistory({
            question: result.question,
            answer: result.text,
            language: state.language,
            recordedAt: new Date().toISOString(),
          }),
        ],
      );
      await client.query(
        "DELETE FROM ileraher_ivr_history WHERE profile_id=$1 AND id NOT IN (SELECT id FROM ileraher_ivr_history WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 50)",
        [state.profileId],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function getJob(state: CallState) {
  await schema();
  await database().query(
    "DELETE FROM ileraher_ivr_jobs WHERE expires_at < now()",
  );
  const data = await database().query(
    "SELECT status,result FROM ileraher_ivr_jobs WHERE id=$1 AND call_hash=$2 AND expires_at>now() AND (profile_id IS NULL OR EXISTS(SELECT 1 FROM ileraher_ivr_profiles p WHERE p.id=profile_id AND p.expires_at>now()))",
    [state.id, callHash(state.call)],
  );
  const row = data.rows[0];
  return row
    ? {
        status: row.status as string,
        result: row.result ? decryptResult<JobResult>(row.result) : null,
      }
    : null;
}
