import { NextRequest } from "next/server";
import { bodyJSON, cycleAPI } from "@/lib/cycle-prediction/http";
import { importPeriods } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return cycleAPI(
    request,
    async (owner, today) =>
      importPeriods(owner, (await bodyJSON(request, 1_048_576)).periods, today),
    201,
  );
}
