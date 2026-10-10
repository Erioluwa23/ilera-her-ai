"use client";
import { useSearchParams } from "next/navigation";
import { validDate } from "@/lib/calendar";
import { todayDate } from "@/lib/ui-utils";
import PeriodLogForm from "./PeriodLogForm";
export default function LogScreen() {
  const search = useSearchParams(),
    requested = search.get("date") || "",
    id = search.get("id") || undefined,
    date = validDate(requested) ? requested : todayDate();
  return <PeriodLogForm key={id || date} initialDate={date} recordId={id} />;
}
