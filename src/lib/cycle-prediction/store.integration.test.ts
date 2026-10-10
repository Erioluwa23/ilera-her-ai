import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PeriodLog } from "../period-store";
const context = vi.hoisted(() => ({
  pool: null as Pool | null,
  embedded: null as PGlite | null,
}));
vi.mock("../db", () => ({
  getDb: () => context.pool!,
  ensureAuthSchema: async () => {},
}));
import { ensureCycleSchema } from "./schema";
import {
  deleteCycleData,
  deletePeriod,
  importPeriods,
  readCycleState,
  saveCyclePreferences,
  savePeriod,
} from "./store";
import { DEFAULT_PREFERENCES } from "./types";
const url = process.env.CYCLE_TEST_DATABASE_URL;
const preferences = {
  ...DEFAULT_PREFERENCES,
  consent: true,
  context: "none" as const,
  reportedCycleLength: 29,
};
const log = (id: string, startDate: string): PeriodLog => ({
  id,
  startDate,
  endDate: startDate,
  flow: "medium",
  pain: 2,
  notes: "Fixture private note",
  previousCycle: "complete",
});
// Never use DATABASE_URL/IVR_DATABASE_URL. This suite only touches an explicitly named disposable DB.
describe("cycle PostgreSQL transactions and account isolation", () => {
  beforeAll(async () => {
    if (url) {
      const parsed = new URL(url);
      if (
        !["localhost", "127.0.0.1", "postgres"].includes(parsed.hostname) ||
        parsed.pathname !== "/ileraher_cycle_test"
      )
        throw new Error("A disposable local cycle test database is required");
      context.pool = new Pool({ connectionString: url, max: 5 });
    } else {
      // The existing SIM pilot dependency supplies embedded PostgreSQL locally.
      // CI runs this same suite against an independent PostgreSQL 16 service.
      context.embedded = new PGlite();
      let queue = Promise.resolve();
      const query = async (sql: string, params?: unknown[]) => {
        if (!params && sql.includes(";")) {
          const result = await context.embedded!.exec(sql);
          return { rows: result.at(-1)?.rows || [], rowCount: 0 };
        }
        const result = await context.embedded!.query(sql, params);
        return { ...result, rowCount: result.rows.length };
      };
      context.pool = {
        query,
        connect: async () => {
          const previous = queue;
          let release = () => {};
          queue = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          return { query, release };
        },
        end: () => context.embedded!.close(),
      } as unknown as Pool;
    }
    vi.stubEnv("CYCLE_DATA_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    await context.pool.query(
      "CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY)",
    );
    await ensureCycleSchema();
  }, 20000);
  beforeEach(async () => {
    await context.pool!.query(
      "TRUNCATE cycle_prediction_evaluations,cycle_predictions,cycle_period_logs,cycle_preferences,users RESTART IDENTITY CASCADE",
    );
    await context.pool!.query(
      "INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES",
    );
  });
  afterAll(async () => {
    await context.pool?.end();
    vi.unstubAllEnvs();
  });
  const setup = async (owner = "1") =>
    saveCyclePreferences(owner, preferences, 0, "2026-10-10");
  it("never returns one account's history, notes or predictions to another", async () => {
    await setup();
    await savePeriod("1", log("p1", "2026-10-01"), "2026-10-10");
    const other = await readCycleState("2", "2026-10-10");
    expect(other.logs).toEqual([]);
    expect(other.preferences.consent).toBe(false);
    expect(other.prediction.predictedDate).toBeNull();
    await setup("2");
    await expect(
      savePeriod("2", log("p1", "2026-10-01"), "2026-10-10", "p1", 1),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      deletePeriod("2", "p1", 1, "2026-10-10"),
    ).rejects.toMatchObject({ status: 409 });
    expect((await readCycleState("1", "2026-10-10")).logs).toHaveLength(1);
  });
  it("requires consent before a record can be stored", async () => {
    await expect(
      savePeriod("1", log("p1", "2026-10-01"), "2026-10-10"),
    ).rejects.toMatchObject({ code: "consent_required" });
    expect(
      (await context.pool!.query("SELECT * FROM cycle_period_logs")).rows,
    ).toHaveLength(0);
  });
  it("stores complete encrypted payloads and versions the date forecast", async () => {
    await setup();
    const saved = await savePeriod("1", log("p1", "2026-10-01"), "2026-10-10");
    expect(saved.prediction).toMatchObject({
      predictedDate: "2026-10-30",
      modelVersion: "pacpe-1.0.0",
    });
    const rows = await context.pool!.query(
      "SELECT payload FROM cycle_period_logs UNION ALL SELECT payload FROM cycle_preferences UNION ALL SELECT payload FROM cycle_predictions",
    );
    for (const row of rows.rows) {
      expect(row.payload.startsWith("v1.")).toBe(true);
      expect(row.payload).not.toContain("2026-10-01");
      expect(row.payload).not.toContain("Fixture private note");
    }
  });
  it("rejects overlap without storing a partial mutation or forecast", async () => {
    await setup();
    const first = await savePeriod(
      "1",
      { ...log("p1", "2026-10-01"), endDate: "2026-10-05" },
      "2026-10-10",
    );
    await expect(
      savePeriod("1", log("p2", "2026-10-03"), "2026-10-10"),
    ).rejects.toMatchObject({ code: "overlap" });
    const after = await readCycleState("1", "2026-10-10");
    expect(after.logs).toHaveLength(1);
    expect(after.revision).toBe(first.revision);
  });
  it("serializes competing edits and rejects the stale version", async () => {
    await setup();
    const first = await savePeriod("1", log("p1", "2026-10-01"), "2026-10-10");
    const edits = await Promise.allSettled([
      savePeriod("1", { ...first.logs[0], pain: 3 }, "2026-10-10", "p1", 1),
      savePeriod("1", { ...first.logs[0], pain: 4 }, "2026-10-10", "p1", 1),
    ]);
    expect(edits.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(edits.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect((await readCycleState("1", "2026-10-10")).logs[0].version).toBe(2);
  });
  it("imports explicitly and repeat imports never overwrite existing edits", async () => {
    await setup();
    const imported = await importPeriods(
      "1",
      [log("legacy1", "2026-09-01"), log("legacy2", "2026-10-01")],
      "2026-10-10",
    );
    expect(imported.prediction.accuracy.evaluated).toBe(0);
    await savePeriod(
      "1",
      { ...imported.logs[0], pain: 6 },
      "2026-10-10",
      imported.logs[0].id,
      1,
    );
    const repeated = await importPeriods(
      "1",
      [log("legacy1", "2026-09-01"), log("legacy2", "2026-10-01")],
      "2026-10-10",
    );
    expect(repeated.logs).toHaveLength(2);
    expect(repeated.logs[0].pain).toBe(6);
  });
  it("measures the unchanged forecast issued before an actual start", async () => {
    await setup();
    const before = await savePeriod("1", log("p1", "2026-01-01"), "2026-01-02");
    // Simulate a prediction made January 2, then a real period arriving January 31.
    await context.pool!.query(
      "UPDATE cycle_predictions SET created_at='2026-01-02T10:00:00Z' WHERE user_id=1",
    );
    const beforeRow = await context.pool!.query(
      "SELECT payload FROM cycle_predictions WHERE user_id=1 AND revision=$1",
      [before.revision],
    );
    const after = await savePeriod("1", log("p2", "2026-01-31"), "2026-02-01");
    expect(after.prediction.accuracy).toMatchObject({
      evaluated: 1,
      maeDays: 1,
    });
    const afterRow = await context.pool!.query(
      "SELECT payload FROM cycle_predictions WHERE user_id=1 AND revision=$1",
      [before.revision],
    );
    expect(afterRow.rows[0].payload).toBe(beforeRow.rows[0].payload);
  });
  it("does not count historical logs as predictions made in advance", async () => {
    await setup();
    await savePeriod("1", log("p1", "2020-01-01"), "2026-10-10");
    const after = await savePeriod("1", log("p2", "2020-01-30"), "2026-10-10");
    expect(after.prediction.accuracy.evaluated).toBe(0);
  });
  it("recalculates corrected dates while preserving superseded original forecasts", async () => {
    await setup();
    const before = await savePeriod("1", log("p1", "2026-10-01"), "2026-10-10");
    const corrected = await savePeriod(
      "1",
      { ...before.logs[0], startDate: "2026-10-02", endDate: "2026-10-02" },
      "2026-10-10",
      "p1",
      1,
    );
    expect(corrected.prediction.predictedDate).toBe("2026-10-31");
    expect(corrected.prediction.accuracy.evaluated).toBe(0);
    const audit = await context.pool!.query(
      "SELECT valid FROM cycle_predictions WHERE user_id=1 AND revision=$1",
      [before.revision],
    );
    expect(audit.rows[0].valid).toBe(false);
  });
  it("deletes logs, preferences, forecasts and evaluations for only the owner", async () => {
    await setup();
    await setup("2");
    await savePeriod("1", log("p1", "2026-10-01"), "2026-10-10");
    await savePeriod("2", log("p2", "2026-10-02"), "2026-10-10");
    await deleteCycleData("1");
    const cleared = await readCycleState("1", "2026-10-10");
    expect(cleared.logs).toEqual([]);
    expect(cleared.preferences.consent).toBe(false);
    expect((await readCycleState("2", "2026-10-10")).logs).toHaveLength(1);
    for (const table of [
      "cycle_period_logs",
      "cycle_preferences",
      "cycle_predictions",
      "cycle_prediction_evaluations",
    ])
      expect(
        (await context.pool!.query(`SELECT * FROM ${table} WHERE user_id=1`))
          .rows,
      ).toHaveLength(0);
  });
});
