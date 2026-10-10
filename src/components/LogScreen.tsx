"use client";
import { useSearchParams } from "next/navigation";
import { todayIn, validDate } from "@/lib/health/date-only";
import PeriodLogForm from "./PeriodLogForm";
export default function LogScreen() {
  const params = useSearchParams(),
    requested = params.get("date"),
    recordId = params.get("id") || undefined;
  const date =
    requested && validDate(requested) ? requested : requested ? "" : todayIn();
  return (
    <PeriodLogForm
      key={recordId || requested || "new"}
      initialDate={date}
      recordId={recordId}
      invalidDate={!!requested && !validDate(requested)}
    />
  );
}
