"use client";
import Link from "next/link";
import { useState } from "react";
import { usePreferences } from "@/lib/experience";
import { useHealthData } from "@/lib/health-store";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { displayDate } from "@/lib/health/date-only";
import EnglishContent from "./EnglishContent";
export default function HomeScreen() {
  const { prefs, update, error } = usePreferences(),
    store = useHealthData(),
    { language } = useLanguage(),
    [change, setChange] = useState(false),
    [focus, setFocus] = useState(prefs.focus);
  const pregnancyInactive =
    prefs.focus === "pregnancy" &&
    store.data.pregnancies.length > 0 &&
    !store.data.pregnancies.some((x) => x.status === "active");
  const target = pregnancyInactive
    ? "/history"
    : prefs.focus === "pregnancy"
      ? "/pregnancy"
      : prefs.focus === "baby"
        ? "/growth"
        : prefs.focus === "conception"
          ? "/conception"
          : "/log";
  const recent = [...store.data.periods]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 3);
  return (
    <section className="homeScreen">
      <div className="sectionHeading">
        <div>
          <span className="eyebrow">
            ÌleraHer · {copy(language, "onDevice")}
          </span>
          <h1>{copy(language, "home")}</h1>
        </div>
        <button
          className="textbtn"
          onClick={() => {
            setFocus(prefs.focus);
            setChange(!change);
          }}
        >
          {copy(language, "changeFocus")}
        </button>
      </div>
      {change && (
        <div className="panel">
          <label>
            {copy(language, "focus")}
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as typeof focus)}
            >
              {(
                [
                  "periods",
                  "general",
                  "conception",
                  "pregnancy",
                  "baby",
                ] as const
              ).map((x) => (
                <option key={x} value={x}>
                  {copy(language, x)}
                </option>
              ))}
            </select>
          </label>
          <p>Changing focus changes Home. Your records stay as they are.</p>
          <button
            className="btn"
            onClick={() => {
              if (update({ focus })) setChange(false);
            }}
          >
            {copy(language, "saveChanges")}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <article className="primaryTask">
        <span className="eyebrow">{copy(language, prefs.focus)}</span>
        <h2>
          {copy(
            language,
            pregnancyInactive
              ? "history"
              : prefs.focus === "pregnancy"
                ? "pregnancy"
                : prefs.focus === "baby"
                  ? "growth"
                  : prefs.focus === "conception"
                    ? "conception"
                    : "logPeriod",
          )}
        </h2>
        <EnglishContent>
          <p>
            {pregnancyInactive
              ? "Pregnancy tracking is paused or ended. You can view your records when you choose."
              : prefs.focus === "periods" || prefs.focus === "general"
                ? "Save the date your period began. Add other details if you want."
                : "Add confirmed details, review them, and choose what to save on this device."}
          </p>
        </EnglishContent>
        <Link className="btn" href={target} prefetch={false}>
          {copy(language, "continue")} →
        </Link>
      </article>
      <div className="homeColumns">
        <article className="panel">
          <h2>{copy(language, "ask")}</h2>
          <p>{copy(language, "purpose")}</p>
          <Link
            className="secondaryBtn"
            href={prefs.lowData ? "/lite" : "/voice"}
            prefetch={false}
          >
            {copy(language, "recordQuestion")} →
          </Link>
        </article>
        <article className="panel">
          <h2>{copy(language, "history")}</h2>
          {!store.loaded ? (
            <p role="status">{copy(language, "loading")}</p>
          ) : store.error ? (
            <p role="alert">{store.error}</p>
          ) : prefs.sharedDevice || prefs.hideSensitivePreviews ? (
            <EnglishContent>
              <p>Open History to view saved records on this device.</p>
            </EnglishContent>
          ) : !recent.length ? (
            <p>{copy(language, "noRecords")}</p>
          ) : (
            recent.map((x) => (
              <p key={x.id}>
                <Link href={"/log?id=" + x.id}>
                  {displayDate(x.startDate, language)}
                </Link>{" "}
                · {copy(language, "periods")}
              </p>
            ))
          )}
          <Link className="textlink" href="/history">
            {copy(language, "history")} →
          </Link>
        </article>
      </div>
    </section>
  );
}
