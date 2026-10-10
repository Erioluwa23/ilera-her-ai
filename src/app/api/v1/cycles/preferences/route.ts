import { NextRequest } from "next/server";
import { bodyJSON, cycleAPI } from "@/lib/cycle-prediction/http";
import { saveCyclePreferences } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
export function PUT(request: NextRequest) {
  return cycleAPI(request, async (owner, today) => {
    const body = await bodyJSON(request);
    return saveCyclePreferences(owner, body.preferences, body.revision, today);
  });
}
