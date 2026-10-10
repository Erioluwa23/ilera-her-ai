import { NextRequest } from "next/server";
import { cycleAPI } from "@/lib/cycle-prediction/http";
import { readCycleState } from "@/lib/cycle-prediction/store";
import { monthDays, validDate } from "@/lib/calendar";
import { loggedOnDate } from "@/lib/period-records";
import { CycleError } from "@/lib/cycle-prediction/validation";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return cycleAPI(request, async (owner, today) => {
    const month =
      request.nextUrl.searchParams.get("month") || today.slice(0, 7);
    if (!validDate(month + "-01")) throw new CycleError("invalid_month");
    const { logs, prediction } = await readCycleState(owner, today);
    return {
      month,
      prediction,
      days: monthDays(month).dates.map((date) => ({
        date,
        recorded: logs.some((log) => loggedOnDate(log, date)),
        predictedStart: prediction.predictedDate === date,
        estimatedWindow:
          !!prediction.windowStart &&
          !!prediction.windowEnd &&
          date >= prediction.windowStart &&
          date <= prediction.windowEnd,
      })),
    };
  });
}
