import { cycleForecast, currentCycleDay } from "./health/cycle-calculations";
import { todayIn } from "./health/date-only";
export type Flow = "spotting" | "light" | "medium" | "heavy";
export type CycleEntry = {
  date: string;
  flow: Flow;
  pain: number;
  notes?: string;
};
const forecast = (starts: string[]) =>
  cycleForecast(
    starts.map((startDate, i) => ({ id: String(i), startDate })),
    todayIn(),
  );
export function averageCycleLength(starts: string[]) {
  const result = forecast(starts);
  return result.estimatedNextStart ? result.estimatedLength : null;
}
export function predictedNextPeriod(starts: string[]) {
  return forecast(starts).estimatedNextStart;
}
export function cycleDay(lastStart: string, today = new Date()) {
  return currentCycleDay(lastStart, todayIn("Africa/Lagos", today));
}
