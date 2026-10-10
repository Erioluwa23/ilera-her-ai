import { NextRequest } from "next/server";
import { cycleAPI } from "@/lib/cycle-prediction/http";
import { readCycleState } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return cycleAPI(
    request,
    async (owner, today) => (await readCycleState(owner, today)).prediction,
  );
}
