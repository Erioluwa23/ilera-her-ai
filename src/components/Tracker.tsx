"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePeriodLogs } from "@/lib/period-store";
import { predictedNextPeriod, cycleDay } from "@/lib/cycle";
import { monthDays, shiftMonth, validDate } from "@/lib/calendar";
import { loggedOnDate, periodForDate, dailyEntry } from "@/lib/period-records";
import { todayDate, displayDate, useOnline } from "@/lib/ui-utils";
import { useUI, symptomText } from "@/lib/ui-language";
import Icon, { Flower } from "./Icon";
export default function Tracker() {
  const { logs, ready } = usePeriodLogs(),
    { t, locale } = useUI(),
    today = todayDate(),
    online = useOnline();
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [info, setInfo] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search),
        cache = JSON.parse(
          sessionStorage.getItem("ileraher-calendar-view") || "{}",
        );
      const date = params.get("date") || cache.selected;
      if (validDate(date)) {
        setSelected(date);
        setMonth(
          params.get("date")
            ? date.slice(0, 7)
            : validDate(cache.month + "-01")
              ? cache.month
              : date.slice(0, 7),
        );
      }
      setSaved(params.get("saved") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 5000);
    return () => clearTimeout(timer);
  }, [saved]);
  function select(date: string, m = month) {
    setSelected(date);
    setMonth(m);
    try {
      sessionStorage.setItem(
        "ileraher-calendar-view",
        JSON.stringify({ selected: date, month: m }),
      );
    } catch {}
  }
  const prediction = predictedNextPeriod(logs.map((x) => x.startDate)),
    last = logs.filter((x) => x.startDate <= today)[0],
    days = monthDays(month),
    period = periodForDate(logs, selected),
    entry =
      period && loggedOnDate(period, selected)
        ? dailyEntry(period, selected)
        : null;
  const title = displayDate(month + "-01", locale, {
    month: "long",
    year: "numeric",
  });
  if (!ready)
    return (
      <p className="ux-loading" role="status">
        {t("loading")}
      </p>
    );
  return (
    <section className="ux-cycle">
      <div className="ux-page-heading">
        <div>
          <p className="ux-eyebrow">
            {displayDate(today, locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>{t("myCycle")}</h1>
        </div>
        <Link className="ux-btn ux-desktop-only" href={"/log?date=" + today}>
          <Icon name="plus" />
          {t("logToday")}
        </Link>
      </div>
      {saved && (
        <p className="ux-success ux-toast" role="status">
          <Icon name="check" />
          {t("logSaved")}
        </p>
      )}
      {!online && (
        <p className="ux-offline">
          <Icon name="wifi" />
          {t("offline")} · {t("savedBrowser")}
        </p>
      )}
      <div className="ux-dashboard-grid">
        <div className="ux-status-card">
          <div>
            <p className="ux-eyebrow">
              {last ? t("periodLogged") : t("stillLearning")}
            </p>
            <h2>
              {last ? (
                <>
                  {t("day")}{" "}
                  {cycleDay(last.startDate, new Date(today + "T12:00:00Z"))}
                </>
              ) : (
                t("emptyCycle")
              )}
            </h2>
            <p>
              {prediction ? (
                <>
                  {t("nextPeriod")}:{" "}
                  {displayDate(prediction, locale, {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {t("estimate")}
                </>
              ) : (
                t("learningHint")
              )}
            </p>
            {prediction && (
              <button
                className="ux-text-button ux-inverse"
                onClick={() => setInfo(!info)}
                aria-expanded={info}
              >
                <Icon name="info" size={16} />
                {t("estimate")}
              </button>
            )}
            {info && <p className="ux-small">{t("estimatedHint")}</p>}
          </div>
          <Flower size={74} />
        </div>
        <aside className="ux-moment ux-desktop-only">
          <h2>{t("moment")}</h2>
          <p>{t("momentHint")}</p>
          <Link href="/voice" className="ux-btn ux-secondary">
            <Icon name="mic" />
            {t("startChat")}
          </Link>
        </aside>
        <div className="ux-cycle-actions ux-mobile-only">
          <Link className="ux-btn" href={"/log?date=" + today}>
            <Icon name="plus" />
            {logs.length ? t("logToday") : t("firstLog")}
          </Link>
          <Link className="ux-btn ux-secondary" href="/voice">
            <Icon name="mic" />
            {t("ask")}
          </Link>
        </div>
        <div className="ux-calendar-card">
          <div className="ux-calendar-heading">
            <h2 aria-live="polite">{title}</h2>
            <div>
              <button
                className="ux-icon-button"
                aria-label={t("previousMonth")}
                onClick={() => select(selected, shiftMonth(month, -1))}
              >
                <Icon name="back" />
              </button>
              <button
                className="ux-icon-button"
                aria-label={t("nextMonth")}
                onClick={() => select(selected, shiftMonth(month, 1))}
              >
                <Icon name="arrow" />
              </button>
            </div>
          </div>
          <div className="ux-calendar-grid" role="group" aria-label={title}>
            {Array.from({ length: 7 }, (_, i) => (
              <span className="ux-weekday" key={i}>
                {displayDate(
                  "2026-10-" + String(4 + i).padStart(2, "0"),
                  locale,
                  { weekday: "short" },
                ).slice(0, 3)}
              </span>
            ))}
            {Array.from({ length: days.offset }, (_, i) => (
              <span key={"blank" + i} aria-hidden="true" />
            ))}
            {days.dates.map((date) => {
              const logged = logs.some((x) => loggedOnDate(x, date));
              return (
                <button
                  key={date}
                  className={[
                    logged ? "is-logged" : "",
                    !logged && date === prediction ? "is-estimate" : "",
                    date === today ? "is-today" : "",
                    date === selected ? "is-selected" : "",
                  ].join(" ")}
                  aria-current={date === today ? "date" : undefined}
                  aria-pressed={date === selected}
                  aria-label={[
                    displayDate(date, locale, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                    logged
                      ? t("logged")
                      : date === prediction
                        ? t("estimate")
                        : t("noLog"),
                    date === today ? t("today") : "",
                    date === selected ? t("selected") : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  onClick={() => select(date)}
                >
                  {Number(date.slice(-2))}
                </button>
              );
            })}
          </div>
          <div className="ux-calendar-footer">
            <div className="ux-legend">
              <span>
                <i className="is-logged" />
                {t("logged")}
              </span>
              <span>
                <i className="is-estimate" />
                {t("estimate")}
              </span>
              <span>
                <i className="is-today" />
                {t("today")}
              </span>
            </div>
            <button
              className="ux-text-button"
              onClick={() => select(today, today.slice(0, 7))}
            >
              {t("today")}
            </button>
          </div>
        </div>
        <aside className="ux-daily-card" aria-live="polite">
          <h2>
            {selected === today ? t("today") : displayDate(selected, locale)}
          </h2>
          <div className="ux-daily-row">
            <span className="ux-icon-circle">
              <Icon name="drop" />
            </span>
            <div>
              {entry ? (
                <>
                  <strong>
                    {t(entry.flow)} · {t("flow")}
                  </strong>
                  <p>
                    {t("pain")} {entry.pain}/10
                    {entry.symptoms?.length
                      ? " · " +
                        entry.symptoms
                          .map((value) => symptomText(value, t))
                          .join(", ")
                      : ""}
                  </p>
                  {entry.notes && <p>{entry.notes}</p>}
                </>
              ) : (
                <p>{t("noLog")}</p>
              )}
            </div>
          </div>
          {selected <= today && (
            <Link
              className="ux-btn ux-secondary"
              href={
                "/log?date=" +
                selected +
                (period ? "&id=" + encodeURIComponent(period.id) : "")
              }
            >
              <Icon name={period ? "edit" : "plus"} />
              {period ? t("edit") : t("logPeriod")}
            </Link>
          )}
        </aside>
        <aside className="ux-nurture ux-desktop-only">
          <Icon name="leaf" size={32} />
          <h2>{t("trackTalk")}</h2>
          <p>{t("healthInfo")}</p>
        </aside>
      </div>
    </section>
  );
}
