import { NextRequest } from "next/server";
import { bodyJSON, cycleAPI } from "@/lib/cycle-prediction/http";
import { deletePeriod, savePeriod } from "@/lib/cycle-prediction/store";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export function PATCH(request: NextRequest, context: Context) {
  return cycleAPI(request, async (owner, today) => {
    const { id } = await context.params,
      body = await bodyJSON(request);
    return savePeriod(owner, body.period, today, id, body.version);
  });
}
export function DELETE(request: NextRequest, context: Context) {
  return cycleAPI(request, async (owner, today) => {
    const { id } = await context.params,
      body = await bodyJSON(request);
    return deletePeriod(owner, id, body.version, today);
  });
}
