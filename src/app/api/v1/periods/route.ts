import { NextRequest } from "next/server";
import { bodyJSON, cycleAPI } from "@/lib/cycle-prediction/http";
import { savePeriod } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return cycleAPI(
    request,
    async (owner, today) =>
      savePeriod(owner, (await bodyJSON(request)).period, today),
    201,
  );
}
