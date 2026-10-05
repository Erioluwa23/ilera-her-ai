import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { callHash, encryptResult, decryptResult, type CallState } from "./ivr";
let pool: Pool | undefined, prepared: Promise<void> | undefined;
function database() {
  if (!process.env.IVR_DATABASE_URL)
    throw new Error("IVR database not configured");
  return (pool ??= new Pool({
    connectionString: process.env.IVR_DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 3000,
    query_timeout: 4000,
  }));
}
async function schema() {
  if (!prepared)
    prepared = (async () => {
      await database().query(
        `CREATE TABLE IF NOT EXISTS ileraher_ivr_jobs (id uuid PRIMARY KEY, call_hash text NOT NULL, language text NOT NULL, recording_sid text NOT NULL, expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, lease_id uuid, result text)`,
      );
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
    "INSERT INTO ileraher_ivr_jobs (id,call_hash,language,recording_sid,expires_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
    [
      state.id,
      callHash(state.call),
      state.language,
      recording,
      new Date(state.expires),
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
export type JobResult = { text: string; audio?: string; contentType?: string };
export async function finish(
  state: CallState,
  lease: string,
  result: JobResult | null,
) {
  await database().query(
    "UPDATE ileraher_ivr_jobs SET status=$3,result=$4,lease_until=NULL WHERE id=$1 AND lease_id=$2",
    [
      state.id,
      lease,
      result ? "ready" : "failed",
      result ? encryptResult(result) : null,
    ],
  );
}
export async function getJob(state: CallState) {
  await schema();
  await database().query(
    "DELETE FROM ileraher_ivr_jobs WHERE expires_at < now()",
  );
  const data = await database().query(
    "SELECT status,result FROM ileraher_ivr_jobs WHERE id=$1 AND call_hash=$2 AND expires_at>now()",
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
