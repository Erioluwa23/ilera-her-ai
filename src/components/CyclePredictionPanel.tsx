"use client";
import Link from "next/link";
import { useEffect } from "react";
import type { PeriodStore } from "@/lib/period-store";
import { useUI, type UIKey } from "@/lib/ui-language";
import { displayDate, todayDate } from "@/lib/ui-utils";
import { daysBetween } from "@/lib/cycle-prediction/engine";
import { cycleContextKeys } from "@/lib/cycle-prediction/ui-rows";
import Icon from "./Icon";
import { useVoicePlayback } from "@/lib/use-voice-playback";

export function reliabilityKey(value: string): UIKey {
  return value === "preliminary"
    ? "preliminary"
    : value === "limited_history"
      ? "limitedHistory"
      : value === "low_predictability"
        ? "lowPredictability"
        : "personalized";
}
export default function CyclePredictionPanel({
  store,
}: {
  store: PeriodStore;
}) {
  const { t, locale, language } = useUI(),
    prediction = store.prediction,
    today = todayDate(),
    voice = useVoicePlayback();
  const spoken = prediction?.predictedDate
    ? [
        t(
          prediction.predictedDate < today ? "lastCycleEstimate" : "nextPeriod",
        ),
        displayDate(prediction.predictedDate, locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        t(reliabilityKey(prediction.reliability)),
        prediction.windowStart && prediction.windowEnd
          ? [
              t("windowEstimate"),
              displayDate(prediction.windowStart, locale),
              displayDate(prediction.windowEnd, locale),
              t("windowHint"),
            ].join(". ")
          : t("noWindow"),
        (prediction.windowEnd || prediction.predictedDate) < today
          ? t("predictionPast")
          : "",
        t("predictionHint"),
      ]
        .filter(Boolean)
        .join(". ")
    : "";
  useEffect(() => {
    voice.stop();
  }, [spoken, language, voice.stop]);
  if (!prediction || !store.preferences.consent) return null;
  const overdue =
    !!prediction.predictedDate &&
    (prediction.windowEnd || prediction.predictedDate) < today;
  const lastMissing = prediction.intervals
    .map((x) => x.disposition)
    .lastIndexOf("missing");
  const review = prediction.intervals
    .slice(lastMissing + 1)
    .filter((x) => x.disposition === "review");
  const statusKey: UIKey =
    prediction.status === "needs_last_period"
      ? "needsLastPeriod"
      : prediction.status === "needs_reported_length"
        ? "needsReportedLength"
        : prediction.status === "history_needs_review"
          ? "reviewHistory"
          : prediction.status === "context_needed"
            ? "predictionContextNeeded"
            : "predictionPaused";
  return (
    <section className="ux-prediction-panel" aria-label={t("cycleInsight")}>
      <div className="ux-prediction-heading">
        <h2>
          <Icon name="sparkle" />
          {t("cycleInsight")}
        </h2>
        {prediction.status === "estimated" && (
          <span
            className={
              "ux-reliability " +
              (prediction.reliability === "low_predictability"
                ? "is-cautious"
                : "")
            }
          >
            {t(reliabilityKey(prediction.reliability))}
          </span>
        )}
      </div>
      {prediction.status === "estimated" && prediction.predictedDate ? (
        <>
          <p className="ux-prediction-date">
            {t(
              prediction.predictedDate < today
                ? "lastCycleEstimate"
                : "nextPeriod",
            )}
            :{" "}
            <strong>
              {displayDate(prediction.predictedDate, locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
          </p>
          {overdue && <p className="ux-alert">{t("predictionPast")}</p>}
          {prediction.windowStart && prediction.windowEnd ? (
            <>
              <p>
                {t("windowEstimate")}:{" "}
                {displayDate(prediction.windowStart, locale)} –{" "}
                {displayDate(prediction.windowEnd, locale)}
              </p>
              <p className="ux-small">{t("windowHint")}</p>
            </>
          ) : (
            <p className="ux-small">{t("noWindow")}</p>
          )}
          <p>{t("predictionHint")}</p>
          <div className="ux-actions">
            <button
              className="ux-btn ux-secondary"
              onClick={() =>
                voice.state === "playing"
                  ? voice.pause()
                  : voice.state === "paused"
                    ? voice.resume()
                    : voice.play(spoken, language, { localOnly: true })
              }
            >
              <Icon name={voice.state === "playing" ? "pause" : "play"} />
              {voice.state === "playing"
                ? t("pause")
                : voice.state === "paused"
                  ? t("resume")
                  : t("listenInsight")}
            </button>
            {voice.state !== "idle" && (
              <button
                className="ux-icon-button"
                aria-label={t("stopInsight")}
                onClick={voice.stop}
              >
                <Icon name="stop" />
              </button>
            )}
          </div>
          <p className="ux-small">{t("deviceVoice")}</p>
          {voice.error && (
            <p role="status" className="ux-small">
              {t("voiceUnavailable")}
            </p>
          )}
          {store.preferences.reminderConsent &&
            !overdue &&
            daysBetween(today, prediction.predictedDate) >= 0 &&
            daysBetween(today, prediction.predictedDate) <= 3 && (
              <p className="ux-success" role="status">
                <Icon name="calendar" />
                {t("periodReminder")}
              </p>
            )}
          <dl className="ux-prediction-metrics">
            <div>
              <dt>{t("completedCycles")}</dt>
              <dd>{prediction.completedCycles}</dd>
            </div>
            <div>
              <dt>{t("measuredPredictions")}</dt>
              <dd>{prediction.accuracy.evaluated}</dd>
            </div>
            {prediction.accuracy.maeDays !== null && (
              <div>
                <dt>{t("observedError")}</dt>
                <dd>{prediction.accuracy.maeDays}</dd>
              </div>
            )}
          </dl>
          {!prediction.accuracy.evaluated && (
            <p className="ux-small">{t("notMeasured")}</p>
          )}
        </>
      ) : (
        <>
          {prediction.status === "context_paused" && (
            <p>
              {t("selectedCycleContext")}:{" "}
              <strong>{t(cycleContextKeys[store.preferences.context])}</strong>
            </p>
          )}
          <p>{t(statusKey)}</p>
          {["context_needed", "context_paused", "needs_reported_length"].includes(
            prediction.status,
          ) && (
            <Link className="ux-text-button" href="#cycle-preferences">
              {t("cycleSetup")}
            </Link>
          )}
        </>
      )}
      {!!review.length && (
        <div className="ux-gap-review">
          <h3>{t("reviewHistory")}</h3>
          <p className="ux-small">{t("gapHint")}</p>
          {review.map((gap) => {
            const log = store.logs.find((x) => x.id === gap.toId);
            return (
              <article key={gap.toId}>
                <p>
                  <strong>
                    {displayDate(gap.startDate, locale)} –{" "}
                    {displayDate(gap.endDate, locale)}
                  </strong>{" "}
                  · {gap.days} {t("day")}
                </p>
                <div className="ux-actions">
                  {gap.days >= 15 && gap.days <= 90 && (
                    <button
                      className="ux-secondary"
                      disabled={store.busy || !log}
                      onClick={() =>
                        log &&
                        void store.save({ ...log, previousCycle: "complete" })
                      }
                    >
                      {t("completeGap")}
                    </button>
                  )}
                  <button
                    className="ux-secondary"
                    disabled={store.busy || !log}
                    onClick={() =>
                      log &&
                      void store.save({ ...log, previousCycle: "missing" })
                    }
                  >
                    {t("missingGap")}
                  </button>
                  <Link
                    className="ux-text-button"
                    href={
                      "/log?date=" +
                      gap.endDate +
                      "&id=" +
                      encodeURIComponent(gap.toId)
                    }
                  >
                    {t("edit")}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
