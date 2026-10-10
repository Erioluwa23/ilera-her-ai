import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDb } from "../db";
import type { PeriodLog } from "../period-store";
import { validatePeriod } from "../period-records";
import { decryptCycle, encryptCycle } from "./encryption";
import { ensureCycleSchema } from "./schema";
import { daysBetween, predictNextPeriod, predictionRegime } from "./engine";
import {
  CONSENT_VERSION,
  DEFAULT_PREFERENCES,
  type CyclePreferences,
  type Prediction,
  type PredictionEvaluation,
  type SavedPrediction,
} from "./types";
import { CycleError, parsePeriod, parsePreferences } from "./validation";

export type CycleState = {
  userId: string;
  revision: number;
  logs: PeriodLog[];
  preferences: CyclePreferences;
  prediction: Prediction | SavedPrediction;
};
type Meta = { revision: number; preferences: CyclePreferences };
async function metadata(db: PoolClient, owner: string): Promise<Meta> {
  const rows = await db.query(
    "SELECT revision,payload FROM cycle_preferences WHERE user_id=$1",
    [owner],
  );
  return rows.rows.length
    ? {
        revision: rows.rows[0].revision,
        preferences: decryptCycle<CyclePreferences>(
          rows.rows[0].payload,
          owner,
          "preferences",
        ),
      }
    : { revision: 0, preferences: { ...DEFAULT_PREFERENCES } };
}
async function records(db: PoolClient, owner: string): Promise<PeriodLog[]> {
  const rows = await db.query(
    "SELECT id,payload,version FROM cycle_period_logs WHERE user_id=$1 ORDER BY created_at,id",
    [owner],
  );
  return rows.rows
    .map((row) => ({
      ...decryptCycle<PeriodLog>(row.payload, owner, `period:${row.id}`),
      version: row.version,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
async function evaluations(
  db: PoolClient,
  owner: string,
): Promise<PredictionEvaluation[]> {
  const rows = await db.query(
    `SELECT e.prediction_id,e.payload FROM cycle_prediction_evaluations e JOIN cycle_predictions p ON p.id=e.prediction_id AND p.user_id=e.user_id WHERE e.user_id=$1 AND p.valid=TRUE ORDER BY e.created_at,e.prediction_id`,
    [owner],
  );
  return rows.rows.map((row) =>
    decryptCycle<PredictionEvaluation>(
      row.payload,
      owner,
      `evaluation:${row.prediction_id}`,
    ),
  );
}
export function eligibleEvaluation(
  forecast: SavedPrediction,
  actual: PeriodLog,
  previousId: string,
): PredictionEvaluation | null {
  // Strictly before the actual start day, not just before the day the user logs it.
  // +14 hours is a conservative upper timezone boundary: an already-started local
  // period cannot become a "future" outcome just because the DB timestamp is UTC.
  const latestLocalIssueDay = new Date(
    Date.parse(forecast.createdAt) + 14 * 3_600_000,
  )
    .toISOString()
    .slice(0, 10);
  if (
    !forecast.predictedDate ||
    forecast.status !== "estimated" ||
    forecast.anchorPeriodId !== previousId ||
    latestLocalIssueDay >= actual.startDate ||
    actual.previousCycle === "missing"
  )
    return null;
  return {
    predictionId: forecast.id,
    actualPeriodId: actual.id,
    actualStartDate: actual.startDate,
    absoluteErrorDays: Math.abs(
      daysBetween(forecast.predictedDate, actual.startDate),
    ),
    windowCovered:
      forecast.windowStart && forecast.windowEnd
        ? actual.startDate >= forecast.windowStart &&
          actual.startDate <= forecast.windowEnd
        : null,
    modelVersion: forecast.modelVersion,
    regime: forecast.regime,
    historyGroup:
      forecast.completedCycles < 3
        ? "coldStart"
        : forecast.reliability === "low_predictability"
          ? "variable"
          : "regular",
  };
}
async function evaluateArrival(
  db: PoolClient,
  owner: string,
  before: PeriodLog[],
  actual: PeriodLog,
  preferences: CyclePreferences,
  today: string,
) {
  const previous = [...before]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(-1);
  if (!previous) return;
  const reconstruction = predictNextPeriod(
    [...before, actual],
    preferences,
    today,
  );
  if (
    reconstruction.intervals.find((x) => x.toId === actual.id)?.disposition !==
    "usable"
  )
    return;
  const candidates = await db.query(
    `SELECT id,payload,revision,created_at FROM cycle_predictions WHERE user_id=$1 AND valid=TRUE ORDER BY created_at DESC,revision DESC`,
    [owner],
  );
  for (const row of candidates.rows) {
    const forecast: SavedPrediction = {
      ...decryptCycle<Prediction>(row.payload, owner, `prediction:${row.id}`),
      id: row.id,
      revision: row.revision,
      createdAt: new Date(row.created_at).toISOString(),
    };
    const evaluation = eligibleEvaluation(forecast, actual, previous.id);
    if (!evaluation) continue;
    await db.query(
      "INSERT INTO cycle_prediction_evaluations(prediction_id,user_id,payload) VALUES($1,$2,$3) ON CONFLICT(prediction_id) DO NOTHING",
      [
        forecast.id,
        owner,
        encryptCycle(evaluation, owner, `evaluation:${forecast.id}`),
      ],
    );
    break;
  }
}
async function invalidate(db: PoolClient, owner: string) {
  // Preserve original forecasts for audit. They cannot influence current accuracy after a correction.
  await db.query(
    "UPDATE cycle_predictions SET valid=FALSE WHERE user_id=$1 AND valid=TRUE",
    [owner],
  );
}
async function bump(db: PoolClient, owner: string) {
  await db.query(
    "UPDATE cycle_preferences SET revision=revision+1,updated_at=NOW() WHERE user_id=$1",
    [owner],
  );
}
async function state(
  db: PoolClient,
  owner: string,
  today: string,
): Promise<CycleState> {
  const meta = await metadata(db, owner),
    logs = await records(db, owner);
  if (!meta.preferences.consent)
    return {
      userId: owner,
      ...meta,
      logs,
      prediction: predictNextPeriod([], meta.preferences, today),
    };
  const saved = await db.query(
    "SELECT id,payload,created_at FROM cycle_predictions WHERE user_id=$1 AND revision=$2 AND valid=TRUE",
    [owner, meta.revision],
  );
  if (saved.rows.length) {
    const row = saved.rows[0];
    return {
      userId: owner,
      ...meta,
      logs,
      prediction: {
        ...decryptCycle<Prediction>(row.payload, owner, `prediction:${row.id}`),
        id: row.id,
        revision: meta.revision,
        createdAt: new Date(row.created_at).toISOString(),
      },
    };
  }
  const prediction = predictNextPeriod(
    logs,
    meta.preferences,
    today,
    await evaluations(db, owner),
  );
  const id = randomUUID();
  const inserted = await db.query(
    "INSERT INTO cycle_predictions(id,user_id,revision,payload,model_version) VALUES($1,$2,$3,$4,$5) RETURNING created_at",
    [
      id,
      owner,
      meta.revision,
      encryptCycle(prediction, owner, `prediction:${id}`),
      prediction.modelVersion,
    ],
  );
  return {
    userId: owner,
    ...meta,
    logs,
    prediction: {
      ...prediction,
      id,
      revision: meta.revision,
      createdAt: new Date(inserted.rows[0].created_at).toISOString(),
    },
  };
}
async function transaction<T>(
  owner: string,
  operation: (db: PoolClient) => Promise<T>,
) {
  await ensureCycleSchema();
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    // Serialize all cycle mutations/read-and-create forecasts for this account.
    const user = await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      owner,
    ]);
    if (!user.rows.length) throw new CycleError("sign_in_required", 401);
    const result = await operation(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export function readCycleState(owner: string, today: string) {
  return transaction(owner, (db) => state(db, owner, today));
}
export function saveCyclePreferences(
  owner: string,
  input: unknown,
  expectedRevision: unknown,
  today: string,
) {
  const preferences = parsePreferences(input, today);
  return transaction(owner, async (db) => {
    const current = await metadata(db, owner);
    if (expectedRevision !== current.revision)
      throw new CycleError("record_changed", 409);
    if (predictionRegime(current.preferences) !== predictionRegime(preferences))
      await invalidate(db, owner);
    await db.query(
      `INSERT INTO cycle_preferences(user_id,revision,payload,consent_version) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET revision=EXCLUDED.revision,payload=EXCLUDED.payload,consent_version=EXCLUDED.consent_version,updated_at=NOW()`,
      [
        owner,
        current.revision + 1,
        encryptCycle(preferences, owner, "preferences"),
        CONSENT_VERSION,
      ],
    );
    return state(db, owner, today);
  });
}
export function savePeriod(
  owner: string,
  input: unknown,
  today: string,
  editingId?: string,
  expectedVersion?: unknown,
) {
  const log = parsePeriod(input, today);
  if (editingId && log.id !== editingId) throw new CycleError("invalid_period");
  return transaction(owner, async (db) => {
    const meta = await metadata(db, owner);
    if (!meta.preferences.consent)
      throw new CycleError("consent_required", 403);
    const before = await records(db, owner),
      existing = before.find((x) => x.id === log.id);
    if (editingId && !existing) throw new CycleError("not_found", 404);
    if (editingId && existing!.version !== expectedVersion)
      throw new CycleError("record_changed", 409);
    if (!editingId && existing) throw new CycleError("record_changed", 409);
    if (!editingId && before.length >= 1000)
      throw new CycleError("record_limit", 409);
    if (validatePeriod(log, before, today)) throw new CycleError("overlap");
    const affected =
      !existing ||
      existing.startDate !== log.startDate ||
      existing.previousCycle !== log.previousCycle;
    const backfill =
      !existing && before.some((x) => x.startDate >= log.startDate);
    if (affected) {
      if (existing || backfill) await invalidate(db, owner);
      else
        await evaluateArrival(db, owner, before, log, meta.preferences, today);
      await bump(db, owner);
    }
    await db.query(
      `INSERT INTO cycle_period_logs(user_id,id,payload,source) VALUES($1,$2,$3,'web') ON CONFLICT(user_id,id) DO UPDATE SET payload=EXCLUDED.payload,version=cycle_period_logs.version+1,updated_at=NOW()`,
      [owner, log.id, encryptCycle(log, owner, `period:${log.id}`)],
    );
    return state(db, owner, today);
  });
}
export function deletePeriod(
  owner: string,
  id: string,
  expectedVersion: unknown,
  today: string,
) {
  return transaction(owner, async (db) => {
    const removed = await db.query(
      "DELETE FROM cycle_period_logs WHERE user_id=$1 AND id=$2 AND version=$3 RETURNING id",
      [owner, id, Number.isInteger(expectedVersion) ? expectedVersion : -1],
    );
    if (!removed.rows.length) throw new CycleError("record_changed", 409);
    await invalidate(db, owner);
    await bump(db, owner);
    return state(db, owner, today);
  });
}
export function importPeriods(owner: string, input: unknown, today: string) {
  if (!Array.isArray(input) || !input.length || input.length > 1000)
    throw new CycleError("invalid_period");
  const incoming = input.map((x) => parsePeriod(x, today));
  if (new Set(incoming.map((x) => x.id)).size !== incoming.length)
    throw new CycleError("invalid_period");
  return transaction(owner, async (db) => {
    const meta = await metadata(db, owner);
    if (!meta.preferences.consent)
      throw new CycleError("consent_required", 403);
    const before = await records(db, owner),
      existing = new Set(before.map((x) => x.id));
    // A repeat of an already acknowledged import is harmless. Never overwrite an account record.
    const additions = incoming.filter((x) => !existing.has(x.id));
    if (before.length + additions.length > 1000)
      throw new CycleError("record_limit", 409);
    const merged = [...before, ...additions];
    if (additions.some((log) => validatePeriod(log, merged, today)))
      throw new CycleError("overlap");
    if (additions.length) {
      await invalidate(db, owner);
      await bump(db, owner);
      const values = additions.flatMap((log) => [
        owner,
        log.id,
        encryptCycle(log, owner, `period:${log.id}`),
      ]);
      const placeholders = additions
        .map(
          (_, i) =>
            `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3},'browser_import')`,
        )
        .join(",");
      await db.query(
        `INSERT INTO cycle_period_logs(user_id,id,payload,source) VALUES ${placeholders}`,
        values,
      );
    }
    return state(db, owner, today);
  });
}
export function deleteCycleData(owner: string) {
  return transaction(owner, async (db) => {
    await db.query(
      "DELETE FROM cycle_prediction_evaluations WHERE user_id=$1",
      [owner],
    );
    await db.query("DELETE FROM cycle_predictions WHERE user_id=$1", [owner]);
    await db.query("DELETE FROM cycle_period_logs WHERE user_id=$1", [owner]);
    await db.query("DELETE FROM cycle_preferences WHERE user_id=$1", [owner]);
    return { ok: true };
  });
}
export function exportCycleData(owner: string, today: string) {
  return transaction(owner, async (db) => {
    const snapshot = await state(db, owner, today);
    const predictions = await db.query(
      "SELECT id,payload,revision,created_at,valid FROM cycle_predictions WHERE user_id=$1 ORDER BY created_at,revision",
      [owner],
    );
    const outcomes = await db.query(
      "SELECT prediction_id,payload FROM cycle_prediction_evaluations WHERE user_id=$1 ORDER BY created_at",
      [owner],
    );
    return {
      userId: owner,
      schema: "ileraher-account-cycles-v1",
      exportedAt: new Date().toISOString(),
      periods: snapshot.logs,
      preferences: snapshot.preferences,
      predictionVersions: predictions.rows.map((row) => ({
        ...decryptCycle<Prediction>(row.payload, owner, `prediction:${row.id}`),
        id: row.id,
        revision: row.revision,
        createdAt: new Date(row.created_at).toISOString(),
        valid: row.valid,
      })),
      evaluationHistory: outcomes.rows.map((row) =>
        decryptCycle<PredictionEvaluation>(
          row.payload,
          owner,
          `evaluation:${row.prediction_id}`,
        ),
      ),
    };
  });
}
