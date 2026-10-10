"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePeriodLogs, type PeriodLog } from "@/lib/period-store";
import { useUI, symptomText } from "@/lib/ui-language";
import { displayDate, downloadJson } from "@/lib/ui-utils";
import Icon, { Flower } from "./Icon";
import Dialog from "./Dialog";
import CycleSetup, { cycleErrorKey } from "./CycleSetup";
import CyclePredictionPanel from "./CyclePredictionPanel";
export default function PeriodHistory() {
  const store = usePeriodLogs(),
    { logs, ready, error } = store,
    { t, locale } = useUI(),
    [tab, setTab] = useState<"periods" | "symptoms" | "notes">("periods"),
    [detail, setDetail] = useState<PeriodLog | null>(null),
    [deleting, setDeleting] = useState(false),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    setDetail(null);
    setDeleting(false);
    setExporting(false);
  }, [store.userId]);
  const visible = logs.filter(
    (x) =>
      tab === "periods" ||
      (tab === "symptoms"
        ? x.symptoms?.length || x.entries?.some((e) => e.symptoms?.length)
        : x.notes || x.entries?.some((e) => e.notes)),
  );
  return (
    <section className="ux-logs">
      <div className="ux-page-heading">
        <h1>{t("myLogs")}</h1>
        <button
          className="ux-icon-button"
          aria-label={t("export")}
          disabled={!logs.length}
          onClick={() => setExporting(true)}
        >
          <Icon name="download" />
        </button>
      </div>
      <p className="ux-muted">{t("savedAccount")}</p>
      <CycleSetup store={store} />
      <Link className="ux-btn ux-full ux-log-primary" href="/log">
        <Icon name="plus" />
        {t("logPeriod")}
      </Link>
      {store.preferences.consent && (
        <>
          <div className="ux-tabs" role="group" aria-label={t("logs")}>
            {(["periods", "symptoms", "notes"] as const).map((x) => (
              <button
                key={x}
                aria-pressed={tab === x}
                className={tab === x ? "is-active" : ""}
                onClick={() => setTab(x)}
              >
                {t(x)}
              </button>
            ))}
          </div>
          <div className="ux-period-timeline">
            {!ready ? (
              <p role="status">{t("loading")}</p>
            ) : !visible.length ? (
              <div className="ux-empty-state">
                <Flower size={84} />
                <h2>{t("noLogs")}</h2>
                <p>{t("trackTalk")}</p>
                <Link className="ux-btn" href="/log">
                  <Icon name="plus" />
                  {t("logPeriod")}
                </Link>
              </div>
            ) : (
              visible.map((log, index) => (
                <div key={log.id}>
                  {(!index ||
                    visible[index - 1].startDate.slice(0, 7) !==
                      log.startDate.slice(0, 7)) && (
                    <h2 className="ux-month-label">
                      {displayDate(log.startDate, locale, {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                  )}
                  <article className="ux-period-row" key={log.id}>
                    <button
                      className="ux-period-open"
                      onClick={() => {
                        setDetail(log);
                        setDeleting(false);
                      }}
                    >
                      <span className="ux-period-icon">
                        <Icon name={tab === "notes" ? "edit" : "drop"} />
                      </span>
                      <span>
                        <strong>
                          {displayDate(log.startDate, locale)}
                          {log.endDate
                            ? " – " +
                              displayDate(log.endDate, locale, {
                                day: "numeric",
                                month: "short",
                              })
                            : log.ongoing
                              ? " · " + t("ongoing")
                              : ""}
                        </strong>
                        <small>
                          {tab === "notes"
                            ? log.notes ||
                              log.entries?.find((e) => e.notes)?.notes
                            : `${t(log.flow)} · ${t("pain")} ${log.pain}/10`}
                        </small>
                        {tab === "symptoms" && (
                          <small>
                            {log.symptoms
                              ?.map((value) => symptomText(value, t))
                              .join(", ") ||
                              log.entries
                                ?.flatMap((e) => e.symptoms || [])
                                .join(", ")}
                          </small>
                        )}
                      </span>
                      <Icon name="arrow" size={20} />
                    </button>
                    <button
                      className="ux-icon-button"
                      aria-label={
                        t("moreOptions") +
                        " · " +
                        displayDate(log.startDate, locale)
                      }
                      onClick={() => {
                        setDetail(log);
                        setDeleting(false);
                      }}
                    >
                      <Icon name="more" />
                    </button>
                  </article>
                </div>
              ))
            )}
          </div>
          <CyclePredictionPanel store={store} />
          {error && (
            <p className="ux-alert" role="alert">
              {t(cycleErrorKey(error))}
            </p>
          )}
          {detail && (
            <Dialog
              title={displayDate(detail.startDate, locale)}
              busy={store.busy}
              onClose={() => {
                setDetail(null);
                setDeleting(false);
              }}
            >
              {deleting ? (
                <>
                  <p>{t("deleteConfirm")}</p>
                  <p>
                    <strong>{displayDate(detail.startDate, locale)}</strong>
                  </p>
                  <button
                    className="ux-btn ux-danger"
                    disabled={store.busy}
                    onClick={async () => {
                      if (await store.remove(detail)) {
                        setDetail(null);
                        setDeleting(false);
                      }
                    }}
                  >
                    <Icon name="trash" />
                    {t("delete")}
                  </button>
                  <button
                    className="ux-btn ux-secondary"
                    onClick={() => setDeleting(false)}
                  >
                    {t("cancel")}
                  </button>
                </>
              ) : (
                <>
                  <p>
                    {t("flow")}: {t(detail.flow)} · {t("pain")}: {detail.pain}
                    /10
                  </p>
                  {detail.symptoms?.length && (
                    <p>
                      {detail.symptoms
                        .map((value) => symptomText(value, t))
                        .join(", ")}
                    </p>
                  )}
                  {detail.notes && <p>{detail.notes}</p>}
                  {!!detail.entries?.length && (
                    <div className="ux-day-entries">
                      {detail.entries.map((e) => (
                        <article key={e.date}>
                          <strong>{displayDate(e.date, locale)}</strong>
                          <p>
                            {t(e.flow)} · {t("pain")} {e.pain}/10
                          </p>
                          {e.notes && <p>{e.notes}</p>}
                          <Link
                            className="ux-text-button"
                            href={
                              "/log?date=" +
                              e.date +
                              "&id=" +
                              encodeURIComponent(detail.id)
                            }
                          >
                            <Icon name="edit" size={18} />
                            {t("edit")}
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                  <Link
                    className="ux-btn"
                    href={
                      "/log?date=" +
                      detail.startDate +
                      "&id=" +
                      encodeURIComponent(detail.id)
                    }
                  >
                    <Icon name="edit" />
                    {t("edit")}
                  </Link>
                  <button
                    className="ux-btn ux-secondary"
                    onClick={() => {
                      setDetail(null);
                      setExporting(true);
                    }}
                  >
                    <Icon name="download" />
                    {t("export")}
                  </button>
                  <button
                    className="ux-text-button ux-danger-text"
                    onClick={() => setDeleting(true)}
                  >
                    <Icon name="trash" />
                    {t("delete")}
                  </button>
                </>
              )}
            </Dialog>
          )}
          {exporting && (
            <Dialog
              title={t("export")}
              onClose={() => setExporting(false)}
              busy={store.busy}
            >
              <p>{t("exportWarning")}</p>
              <button
                className="ux-btn"
                disabled={store.busy}
                onClick={async () => {
                  const records = await store.exportRecords();
                  if (records) {
                    downloadJson(records, "ileraher-periods.json");
                    setExporting(false);
                  }
                }}
              >
                <Icon name="download" />
                {t("download")}
              </button>
            </Dialog>
          )}
        </>
      )}
    </section>
  );
}
