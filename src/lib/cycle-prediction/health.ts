import { getDb } from "../db";
import { encryptCycle } from "./encryption";
import { ensureCycleSchema } from "./schema";
export async function cycleStorageReady() {
  try {
    // Validate encryption before creating the schema, without storing the probe.
    encryptCycle({ probe: true }, "health", "probe");
    await ensureCycleSchema();
    await getDb().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
