"use client";
import { useState } from "react";
import Link from "next/link";
import { usePeriodLogs } from "@/lib/period-store";
import { averageCycleLength, predictedNextPeriod } from "@/lib/cycle";
import { includesDate, monthDays, shiftMonth } from "@/lib/calendar";
export default function Tracker() {
  const { logs } = usePeriodLogs();
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today);
  const starts = logs.map((x) => x.startDate),
    prediction = predictedNextPeriod(starts);
  const days = monthDays(month),
    entries = logs.filter((x) => includesDate(x, selected));
  const title = new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
  return (
    <section className="panel cycleScreen">
      <div className="sectionHeading">
        <div>
          <span className="eyebrow">My cycle</span>
          <h1>Your cycle at a glance</h1>
        </div>
        <span className="pill">On this device</span>
      </div>
      <div className="predictionCard">
        <span className="eyebrow">Next period</span>
        <h2>
          {prediction ? "Around " + prediction : "Getting to know your cycle"}
        </h2>
        <p>
          {prediction
            ? "Estimate only. Your cycle can change."
            : "Save at least two period starts to see an estimate."}
        </p>
      </div>
      <div className="interactiveCalendar">
        <div className="calendarTitle">
          <button
            className="secondaryBtn"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </button>
          <strong aria-live="polite">{title}</strong>
          <button
            className="secondaryBtn"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
        <div
          className="calendarGrid"
          role="group"
          aria-label={title + " calendar"}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
            <span className="weekday" key={x}>
              {x}
            </span>
          ))}
          {Array.from({ length: days.offset }, (_, i) => (
            <span key={"blank" + i} aria-hidden="true" />
          ))}
          {days.dates.map((date) => {
            const logged = logs.some((x) => includesDate(x, date));
            return (
              <button
                key={date}
                className={[
                  logged ? "logged" : date === prediction ? "predicted" : "",
                  date === today ? "today" : "",
                  date === selected ? "selected" : "",
                ].join(" ")}
                aria-pressed={selected === date}
                aria-label={
                  date +
                  (logged
                    ? ", logged period"
                    : date === prediction
                      ? ", estimated period"
                      : "")
                }
                onClick={() => setSelected(date)}
              >
                {Number(date.slice(-2))}
              </button>
            );
          })}
        </div>
        <div className="calendarActions">
          <p className="calendarLegend">
            Green: logged · Lemon: estimate · Outline: today
          </p>
          <button
            className="textbtn"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            Today
          </button>
        </div>
      </div>
      <div className="selectedDay" aria-live="polite">
        <h2>{selected}</h2>
        {entries.length ? (
          entries.map((x) => (
            <p key={x.id}>
              {x.flow} flow · Pain {x.pain}/10
              {x.symptoms?.length ? " · " + x.symptoms.join(", ") : ""}
            </p>
          ))
        ) : (
          <p className="muted">
            {selected === prediction
              ? "Estimated next start. This is not a saved period."
              : "No period recorded for this day."}
          </p>
        )}
        <Link
          className="btn linkbtn"
          href={"/log?date=" + selected}
          prefetch={false}
        >
          {entries.length ? "View / update log" : "Log a period here"} →
        </Link>
      </div>
      <div className="screenActions">
        <Link className="secondaryBtn" href="/voice" prefetch={false}>
          🎙 Ask by voice
        </Link>
        <Link className="secondaryBtn" href="/history" prefetch={false}>
          My period logs
        </Link>
      </div>
      <div className="stats">
        <div>
          <b>{averageCycleLength(starts) ?? "—"}</b>
          <span>average cycle days</span>
        </div>
        <div>
          <b>{logs.length}</b>
          <span>saved periods</span>
        </div>
      </div>
    </section>
  );
}
