import { NextRequest } from "next/server";
import { cycleAPI } from "@/lib/cycle-prediction/http";
import { deleteCycleData, readCycleState } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return cycleAPI(request, (owner, today) => readCycleState(owner, today));
}
export function DELETE(request: NextRequest) {
  return cycleAPI(request, (owner) => deleteCycleData(owner));
}
