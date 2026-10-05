"use client";
import { useSearchParams } from "next/navigation";
import { validDate } from "@/lib/calendar";
import PeriodLogForm from "./PeriodLogForm";
export default function LogScreen() {
  const search = useSearchParams(),
    requested = search.get("date") ?? "";
  const date = validDate(requested)
    ? requested
    : new Date().toISOString().slice(0, 10);
  return <PeriodLogForm key={date} initialDate={date} />;
}
