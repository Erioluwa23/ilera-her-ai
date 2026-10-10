"use client";
import { useEffect, useState } from "react";
import {
  deleteLegacyPeriods,
  readLegacyPeriods,
  type PeriodLog,
  type PeriodStore,
} from "@/lib/period-store";
import type {
  CycleContext,
  CyclePreferences,
} from "@/lib/cycle-prediction/types";
import { useUI, type UIKey } from "@/lib/ui-language";
import { displayDate, todayDate } from "@/lib/ui-utils";
import Dialog from "./Dialog";
import Icon from "./Icon";

export function cycleErrorKey(error: string): UIKey {
  if (["account_changed", "record_changed"].includes(error))
    return "recordChanged";
  if (error === "overlap") return "overlap";
  if (["invalid_period", "invalid_preferences"].includes(error))
    return "validDates";
  if (error === "consent_required") return "cycleConsent";
  return "serverSaveError";
}
export default function CycleSetup({ store }: { store: PeriodStore }) {
  const { t, locale } = useUI();
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [length, setLength] = useState(""),
    [periodLength, setPeriodLength] = useState(""),
    [context, setContext] = useState<CycleContext>("not_provided"),
    [from, setFrom] = useState(""),
    [reminder, setReminder] = useState(false),
    [notice, setNotice] = useState(""),
    [legacy, setLegacy] = useState<PeriodLog[] | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [owns, setOwns] = useState(false);
  useEffect(() => {
    setOpen(false);
    setLegacy(null);
    setSelected(new Set());
    setOwns(false);
    setNotice("");
  }, [store.userId]);
  function preferences() {
    const p = store.preferences;
    setConsent(p.consent);
    setLength(p.reportedCycleLength?.toString() || "");
    setPeriodLength(p.reportedPeriodLength?.toString() || "");
    setContext(p.context);
    setFrom(p.historyStartDate || "");
    setReminder(p.reminderConsent);
    setNotice("");
    setOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const p: CyclePreferences = {
      consent,
      reportedCycleLength: length === "" ? null : Number(length),
      reportedPeriodLength: periodLength === "" ? null : Number(periodLength),
      context,
      historyStartDate: from || null,
      reminderConsent: reminder,
    };
    if (await store.setPreferences(p)) {
      setOpen(false);
      setNotice(t("saved"));
    }
  }
  if (!store.ready)
    return (
      <p role="status" className="ux-loading">
        {t("loading")}
      </p>
    );
  if (!store.userId)
    return (
      <div className="ux-cycle-setup">
        <p role="alert">{t("cycleUnavailable")}</p>
        <button
          className="ux-btn ux-secondary"
          onClick={() => void store.reload()}
        >
          {t("retryCycles")}
        </button>
      </div>
    );
  const options: [CycleContext, UIKey][] = [
    ["not_provided", "contextUnknown"],
    ["none", "contextNone"],
    ["pregnancy", "contextPregnancy"],
    ["postpartum", "contextPostpartum"],
    ["breastfeeding", "contextBreastfeeding"],
    ["hormonal", "contextHormonal"],
    ["major_change", "contextChange"],
  ];
  return (
    <section className="ux-cycle-setup">
      <div className="ux-cycle-setup-heading">
        <div>
          <h2>
            <Icon name="lock" size={20} />
            {store.preferences.consent ? t("cycleSetup") : t("enableCycles")}
          </h2>
          <p>
            {store.preferences.consent ? t("savedAccount") : t("cycleStorage")}
          </p>
        </div>
        <button className="ux-btn ux-secondary" onClick={preferences}>
          {store.preferences.consent ? t("cycleSetup") : t("enableCycles")}
        </button>
      </div>
      {store.preferences.consent && (
        <details>
          <summary>{t("privacyDetails")}</summary>
          <p>{t("cycleStorage")}</p>
        </details>
      )}
      <button
        className="ux-text-button"
        onClick={() => {
          setLegacy(readLegacyPeriods());
          setSelected(new Set());
          setOwns(false);
          setNotice("");
        }}
      >
        <Icon name="logs" size={18} />
        {t("legacyRecords")} · {t("reviewImport")}
      </button>
      {notice && (
        <p role="status" className="ux-success">
          {notice}
        </p>
      )}
      {store.error && (
        <p role="alert" className="ux-alert">
          {t(cycleErrorKey(store.error))}{" "}
          <button
            className="ux-text-button"
            onClick={() => void store.reload()}
          >
            {t("retryCycles")}
          </button>
        </p>
      )}
      {open && (
        <Dialog
          title={t("cycleSetup")}
          onClose={() => setOpen(false)}
          busy={store.busy}
        >
          <form className="ux-cycle-preferences" onSubmit={save}>
            <p>{t("cycleStorage")}</p>
            <label className="ux-check-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t("cycleConsent")}
            </label>
            <label>
              {t("reportedCycle")}
              <input
                type="number"
                min={15}
                max={90}
                step={1}
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </label>
            <p className="ux-small">{t("lengthHint")}</p>
            <label>
              {t("reportedPeriod")}
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={periodLength}
                onChange={(e) => setPeriodLength(e.target.value)}
              />
            </label>
            <label>
              {t("cycleContext")}
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as CycleContext)}
              >
                {options.map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
            {context !== "none" && (
              <p className="ux-small">{t("predictionPaused")}</p>
            )}
            <label>
              {t("historyFrom")}
              <input
                type="date"
                max={todayDate()}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <p className="ux-small">{t("historyFromHint")}</p>
            <label className="ux-check-label">
              <input
                type="checkbox"
                checked={reminder}
                onChange={(e) => setReminder(e.target.checked)}
              />
              {t("reminderInApp")}
            </label>
            <p className="ux-small">{t("reminderHint")}</p>
            {store.error && (
              <p role="alert" className="ux-alert">
                {t(cycleErrorKey(store.error))}
              </p>
            )}
            <button
              className="ux-btn ux-full"
              disabled={!consent || store.busy}
            >
              {store.busy ? t("loading") : t("savePreferences")}
            </button>
          </form>
        </Dialog>
      )}
      {legacy && (
        <Dialog
          title={t("legacyRecords")}
          onClose={() => setLegacy(null)}
          busy={store.busy}
        >
          <p>{t("importHint")}</p>
          {!legacy.length ? (
            <p>{t("noBrowserRecords")}</p>
          ) : (
            <>
              <div className="ux-legacy-list">
                {legacy.map((log) => (
                  <article key={log.id}>
                    <label className="ux-check-label">
                      <input
                        type="checkbox"
                        checked={selected.has(log.id)}
                        onChange={(e) =>
                          setSelected((previous) => {
                            const next = new Set(previous);
                            if (e.target.checked) next.add(log.id);
                            else next.delete(log.id);
                            return next;
                          })
                        }
                      />
                      {displayDate(log.startDate, locale)} · {t(log.flow)}
                    </label>
                    <label>
                      {t("ended")}
                      <input
                        type="date"
                        aria-label={
                          t("ended") +
                          " · " +
                          displayDate(log.startDate, locale)
                        }
                        min={log.startDate}
                        max={todayDate()}
                        value={log.endDate || ""}
                        onChange={(e) =>
                          setLegacy((previous) =>
                            previous!.map((item) =>
                              item.id === log.id
                                ? {
                                    ...item,
                                    endDate: e.target.value || undefined,
                                    ongoing: false,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    {log.ongoing && <p className="ux-small">{t("ongoing")}</p>}
                  </article>
                ))}
              </div>
              <label className="ux-check-label">
                <input
                  type="checkbox"
                  checked={owns}
                  onChange={(e) => setOwns(e.target.checked)}
                />
                {t("ownRecords")}
              </label>
              {!store.preferences.consent && <p>{t("enableCycles")}</p>}
              <button
                className="ux-btn ux-full"
                disabled={
                  store.busy ||
                  !owns ||
                  !selected.size ||
                  !store.preferences.consent
                }
                onClick={async () => {
                  if (
                    await store.importLegacy(
                      legacy.filter((x) => selected.has(x.id)),
                    )
                  ) {
                    setLegacy(null);
                    setNotice(t("savedAccount"));
                  }
                }}
              >
                {store.busy ? t("loading") : t("importSelected")}
              </button>
              <button
                className="ux-text-button ux-danger-text"
                disabled={store.busy}
                onClick={() => {
                  if (window.confirm(t("deleteConfirm"))) {
                    try {
                      deleteLegacyPeriods();
                      setLegacy([]);
                    } catch {
                      setNotice(t("saveError"));
                    }
                  }
                }}
              >
                {t("removeBrowserRecords")}
              </button>
            </>
          )}
          {store.error && (
            <p role="alert" className="ux-alert">
              {t(cycleErrorKey(store.error))}
            </p>
          )}
        </Dialog>
      )}
    </section>
  );
}
