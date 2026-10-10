import { ensureAuthSchema, getDb } from "../db";
let ready: Promise<void> | null = null;
export function ensureCycleSchema() {
  if (!ready)
    ready = (async () => {
      await ensureAuthSchema();
      const client = await getDb().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(748392016)");
        await client.query(`
        CREATE TABLE IF NOT EXISTS cycle_preferences (
          user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL,
          consent_version TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS cycle_period_logs (
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          id TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
          source TEXT NOT NULL CHECK (source IN ('web','browser_import')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id,id)
        );
        CREATE TABLE IF NOT EXISTS cycle_predictions (
          id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          revision INTEGER NOT NULL, payload TEXT NOT NULL, model_version TEXT NOT NULL,
          valid BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id,revision)
        );
        CREATE TABLE IF NOT EXISTS cycle_prediction_evaluations (
          prediction_id UUID PRIMARY KEY REFERENCES cycle_predictions(id) ON DELETE CASCADE,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payload TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS cycle_predictions_owner ON cycle_predictions(user_id,created_at DESC);
      `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}
