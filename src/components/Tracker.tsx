"use client";
import { useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { usePeriodLogs } from "@/lib/period-store";
import { includesDate, monthDays, shiftMonth } from "@/lib/calendar";
import { displayDate } from "@/lib/health/date-only";
import {
  cycleForecast,
  currentCycleDay,
} from "@/lib/health/cycle-calculations";
import { publishable, POLICIES } from "@/lib/health/policies";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import EnglishContent from "./EnglishContent";
export default function Tracker() {
  const { logs, error, loaded } = usePeriodLogs(),
    { language } = useLanguage(),
    today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [view, setView] = useState<"calendar" | "list">("calendar");
  const forecast = cycleForecast(logs, today),
    prediction = publishable(POLICIES.period, today)
      ? forecast.estimatedNextStart
      : null;
  const days = monthDays(month),
    entries = logs.filter((x) => includesDate(x, selected));
  const title = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
  if (!loaded) return <p role="status">{error || copy(language, "loading")}</p>;
  return (
    <section className="panel cycleScreen">
      <div className="sectionHeading">
        <div>
          <span className="eyebrow">{copy(language, "track")}</span>
          <h1>{copy(language, "periods")}</h1>
        </div>
        <Link className="textlink" href="/track">
          {copy(language, "track")} →
        </Link>
      </div>
      {error && (
        <p role="alert" className="risk urgent">
          {error}
        </p>
      )}
      <div className="predictionCard">
        <h2>
          {!logs.length
            ? copy(language, "noRecords")
            : prediction
              ? "Estimated next start: " + displayDate(prediction, language)
              : displayDate(logs[0].startDate, language)}
        </h2>
        {logs.length > 0 && !forecast.reasons.includes("invalid_dates") && (
          <p>
            Day {currentCycleDay(logs[0].startDate, today)} since your most
            recent recorded start.
          </p>
        )}
        <EnglishContent>
          <p>
            {prediction
              ? "Estimate only. The observed range is not a confidence interval."
              : !logs.length
                ? "Save your first period start. You can add other details if you want."
                : "Your dates are recorded. Predictions are paused while the calculation policy is reviewed."}
          </p>
          {forecast.reasons.includes("more_period_records_needed") &&
            logs.length > 0 && (
              <p>
                At least four confirmed starts are needed to describe three
                complete cycles.
              </p>
            )}
        </EnglishContent>
        <Link className="btn" href="/log">
          {copy(language, "logPeriod")} →
        </Link>
      </div>
      <div
        className="screenActions"
        role="group"
        aria-label={copy(language, "calendar")}
      >
        <button
          className="secondaryBtn"
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        >
          {copy(language, "calendar")}
        </button>
        <button
          className="secondaryBtn"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          {copy(language, "list")}
        </button>
        <button
          className="textbtn"
          onClick={() => {
            setMonth(today.slice(0, 7));
            setSelected(today);
          }}
        >
          {copy(language, "today")}
        </button>
      </div>
      <div className="calendarTitle">
        <button
          className="secondaryBtn"
          aria-label={copy(language, "previousMonth")}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <strong aria-live="polite">{title}</strong>
        <button
          className="secondaryBtn"
          aria-label={copy(language, "nextMonth")}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>
      {view === "calendar" ? (
        <div className="calendarGrid" role="group" aria-label={title}>
          {Array.from({ length: 7 }, (_, i) => (
            <span className="weekday" key={i}>
              {new Intl.DateTimeFormat(language, {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, 9, 4 + i)))}
            </span>
          ))}
          {Array.from({ length: days.offset }, (_, i) => (
            <span key={"blank" + i} aria-hidden="true" />
          ))}
          {days.dates.map((date) => {
            const recorded = logs.some((x) => includesDate(x, date)),
              estimated =
                !!prediction &&
                date >= forecast.observedRangeStart! &&
                date <= forecast.observedRangeEnd!;
            return (
              <button
                key={date}
                className={[
                  recorded ? "logged" : estimated ? "predicted" : "",
                  date === today ? "today" : "",
                  date === selected ? "selected" : "",
                ].join(" ")}
                aria-pressed={date === selected}
                aria-label={[
                  displayDate(date, language),
                  recorded
                    ? copy(language, "recorded")
                    : estimated
                      ? "Estimated timing"
                      : "",
                  date === today ? copy(language, "today") : "",
                  date === selected ? copy(language, "selected") : "",
                ]
                  .filter(Boolean)
                  .join(", ")}
                onClick={() => setSelected(date)}
              >
                {Number(date.slice(-2))}
                {recorded && (
                  <span className="calendarMarker" aria-hidden="true">
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="dateList">
          {days.dates.map((date) => (
            <li key={date}>
              <button
                className="secondaryBtn"
                aria-pressed={date === selected}
                onClick={() => setSelected(date)}
              >
                {displayDate(date, language)}
                {logs.some((x) => includesDate(x, date))
                  ? " · " + copy(language, "recorded")
                  : ""}
                {date === today ? " · " + copy(language, "today") : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="calendarLegend">
        ● {copy(language, "recorded")} · ◯ {copy(language, "today")}
      </p>
      <div className="selectedDay" aria-live="polite">
        <h2>{displayDate(selected, language)}</h2>
        {entries.length ? (
          entries.map((x) => (
            <p key={x.id}>
              <Link className="textlink" href={"/log?id=" + x.id}>
                {copy(language, "viewRecord")}
              </Link>{" "}
              ·{" "}
              {x.flow ? copy(language, x.flow) : copy(language, "notProvided")}
            </p>
          ))
        ) : (
          <>
            <p>{copy(language, "noPeriod")}</p>
            {selected <= today && (
              <Link className="secondaryBtn" href={"/log?date=" + selected}>
                {copy(language, "logPeriod")}
              </Link>
            )}
          </>
        )}
      </div>
      <EnglishContent>
        <details>
          <summary>How your record summary was worked out</summary>
          <p>
            Complete recent intervals:{" "}
            {forecast.intervals.map((x) => x.days).join(", ") || "none"}. All
            original records remain in History.
          </p>
          <p>
            Method: {forecast.methodVersion}. Policy status: awaiting local
            clinical sign-off. No future estimate is published.
          </p>
          {forecast.reasons.length > 0 && (
            <p>
              History checks:{" "}
              {forecast.reasons.map((x) => x.replaceAll("_", " ")).join("; ")}
            </p>
          )}
        </details>
      </EnglishContent>
      <div className="screenActions">
        <Link className="textlink" href="/fertility">
          {copy(language, "fertility")}
        </Link>
        <Link className="textlink" href="/late-period">
          Delayed period help
        </Link>
      </div>
    </section>
  );
}
