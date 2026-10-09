import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL || process.env.IVR_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Database is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export function ensureAuthSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          phone_e164 TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS users_phone_e164_idx
        ON users (phone_e164);
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS feedback_created_at_idx
        ON feedback (created_at DESC);
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS feedback_status_idx
        ON feedback (status);
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
