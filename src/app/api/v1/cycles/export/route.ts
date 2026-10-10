import { NextRequest } from "next/server";
import { cycleAPI } from "@/lib/cycle-prediction/http";
import { exportCycleData } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return cycleAPI(request, (owner, today) => exportCycleData(owner, today));
}
