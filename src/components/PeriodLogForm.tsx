"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeriodLogs, type Flow, type PeriodLog } from "@/lib/period-store";
import {
  periodForDate,
  validatePeriod,
  dailyEntry,
} from "@/lib/period-records";
import { assessSymptoms } from "@/lib/safety";
import { todayDate } from "@/lib/ui-utils";
import { useUI } from "@/lib/ui-language";
import Icon, { type IconName } from "./Icon";
import CycleSetup, { cycleErrorKey } from "./CycleSetup";
const symptomChoices: {
  value: string;
  key: "cramps" | "tired" | "tender" | "headache";
  icon: IconName;
}[] = [
  { value: "Cramps", key: "cramps", icon: "sparkle" },
  { value: "Tired", key: "tired", icon: "moon" },
  { value: "Tender breasts", key: "tender", icon: "heart" },
  { value: "Headache", key: "headache", icon: "info" },
];
type Draft = {
  ownerId: string | null;
  date: string;
  end: string;
  ongoing: boolean;
  flow: Flow;
  pain: number;
  symptoms: string[];
  notes: string;
  editingId: string | null;
  previousCycle: "unknown" | "complete" | "missing";
};
export default function PeriodLogForm({
  initialDate,
  recordId,
}: {
  initialDate: string;
  recordId?: string;
}) {
  const store = usePeriodLogs(),
    { t } = useUI(),
    router = useRouter(),
    today = todayDate(),
    initialized = useRef<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
      ownerId: null,
      date: initialDate,
      end: "",
      ongoing: true,
      flow: "light",
      pain: 0,
      symptoms: [],
      notes: "",
      editingId: null,
      previousCycle: "unknown",
    }),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(""),
    [more, setMore] = useState(false),
    [noteOpen, setNoteOpen] = useState(false);
  const key =
    "ileraher-log-draft:" + store.userId + ":" + (recordId || initialDate);
  useEffect(() => {
    if (
      !store.ready ||
      !store.userId ||
      !store.preferences.consent ||
      initialized.current === store.userId
    )
      return;
    initialized.current = store.userId;
    setDirty(false);
    const existing = recordId
      ? store.logs.find((x) => x.id === recordId)
      : periodForDate(store.logs, initialDate);
    let value: Draft = {
      ownerId: store.userId,
      date: existing?.startDate || initialDate,
      end: existing?.endDate || "",
      ongoing: existing ? existing.ongoing === true : false,
      flow: existing?.flow || "light",
      pain: existing?.pain || 0,
      symptoms: existing?.symptoms || [],
      notes: existing?.notes || "",
      editingId: existing?.id || null,
      previousCycle: existing?.previousCycle || "unknown",
    };
    if (existing) {
      const daily = dailyEntry(existing, initialDate);
      value = {
        ...value,
        flow: daily.flow,
        pain: daily.pain,
        symptoms: daily.symptoms || [],
        notes: daily.notes || "",
      };
    } else value.ongoing = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (
        cached &&
        cached.ownerId === store.userId &&
        typeof cached.date === "string" &&
        ["spotting", "light", "medium", "heavy"].includes(cached.flow) &&
        typeof cached.pain === "number"
      ) {
        value = { ...cached, previousCycle: cached.previousCycle || "unknown" };
        setDirty(true);
      }
    } catch {}
    setDraft(value);
    setNoteOpen(!!value.notes);
  }, [
    store.ready,
    store.userId,
    store.preferences.consent,
    store.logs,
    recordId,
    initialDate,
    key,
  ]);
  useEffect(() => {
    if (!dirty || !store.userId || draft.ownerId !== store.userId) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {}
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (a && !window.confirm(t("unsavedChanges"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, draft, key, t, store.userId]);
  function update(p: Partial<Draft>) {
    setDraft((v) => ({ ...v, ...p }));
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (draft.ownerId !== store.userId) return;
    const original = store.logs.find((x) => x.id === draft.editingId);
    const candidate =
      initialDate >= draft.date && initialDate <= today
        ? initialDate
        : draft.date;
    const day =
      !draft.ongoing && draft.end && candidate > draft.end
        ? draft.end
        : candidate;
    const entry = {
      date: day,
      flow: draft.flow,
      pain: draft.pain,
      symptoms: draft.symptoms,
      notes: draft.notes.trim() || undefined,
    };
    const log: PeriodLog = {
      ...original,
      id: draft.editingId || crypto.randomUUID(),
      startDate: draft.date,
      endDate: draft.ongoing ? undefined : draft.end || undefined,
      ongoing: draft.ongoing,
      previousCycle: draft.previousCycle,
      flow: draft.flow,
      pain: draft.pain,
      symptoms: draft.symptoms,
      notes: draft.notes.trim() || undefined,
      entries: [
        ...(original?.entries || []).filter(
          (e) =>
            e.date !== day &&
            e.date >= draft.date &&
            (draft.ongoing || !draft.end || e.date <= draft.end),
        ),
        entry,
      ],
    };
    const invalid = validatePeriod(log, store.logs, today);
    if (invalid) {
      setMessage(t(invalid));
      return;
    }
    if (await store.save(log)) {
      setDirty(false);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      router.push("/cycle?date=" + day + "&saved=1");
    } else setMessage(t("serverSaveError"));
  }
  const safety = assessSymptoms({
    pain: draft.pain,
    heavyBleeding: draft.flow === "heavy",
  });
  if (!store.ready || !store.userId || !store.preferences.consent)
    return (
      <section className="ux-form-screen">
        <h1>{t("logPeriod")}</h1>
        <CycleSetup store={store} />
      </section>
    );
  if (recordId && !store.logs.some((log) => log.id === recordId))
    return (
      <section className="ux-form-screen">
        <p role="alert">{t("recordChanged")}</p>
        <button
          className="ux-btn ux-secondary"
          onClick={() => void store.reload()}
        >
          {t("retryCycles")}
        </button>
      </section>
    );
  return (
    <section className="ux-form-screen">
      <div className="ux-page-heading">
        <button
          className="ux-icon-button"
          aria-label={t("back")}
          onClick={() => {
            if (!dirty || window.confirm(t("unsavedChanges")))
              router.push("/cycle?date=" + initialDate);
          }}
        >
          <Icon name="back" />
        </button>
        <h1>{draft.editingId ? t("edit") : t("logPeriod")}</h1>
      </div>
      <div className="ux-log-fields">
        <fieldset>
          <legend>{t("periodDates")}</legend>
          <div className="ux-date-fields">
            <label>
              {t("started")}
              <input
                type="date"
                max={today}
                value={draft.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </label>
            <label>
              {t("ended")}
              {draft.ongoing ? (
                <button
                  className="ux-select-like"
                  onClick={() => update({ ongoing: false })}
                >
                  {t("ongoing")}
                  <Icon name="down" />
                </button>
              ) : (
                <input
                  type="date"
                  aria-label={t("ended")}
                  min={draft.date}
                  max={today}
                  value={draft.end}
                  onChange={(e) => update({ end: e.target.value })}
                />
              )}
            </label>
          </div>
          <label className="ux-check-label">
            <input
              type="checkbox"
              checked={draft.ongoing}
              onChange={(e) => update({ ongoing: e.target.checked })}
            />
            {t("ongoing")}
          </label>
        </fieldset>
        {store.logs.some(
          (log) => log.id !== draft.editingId && log.startDate < draft.date,
        ) && (
          <fieldset>
            <legend>{t("completeGap")}</legend>
            <p className="ux-small">{t("gapHint")}</p>
            <select
              aria-label={t("completeGap")}
              value={draft.previousCycle}
              onChange={(e) =>
                update({
                  previousCycle: e.target.value as Draft["previousCycle"],
                })
              }
            >
              <option value="unknown">{t("unknownGap")}</option>
              <option value="complete">{t("completeGap")}</option>
              <option value="missing">{t("missingGap")}</option>
            </select>
          </fieldset>
        )}
        <fieldset>
          <legend>{t("flow")}</legend>
          <div className="ux-flow-choices">
            {(["light", "medium", "heavy"] as Flow[]).map((flow, i) => (
              <button
                type="button"
                key={flow}
                className={draft.flow === flow ? "is-active" : ""}
                aria-pressed={draft.flow === flow}
                onClick={() => update({ flow })}
              >
                <span>
                  {Array.from({ length: i + 1 }, (_, n) => (
                    <Icon key={n} name="drop" />
                  ))}
                </span>
                {t(flow)}
              </button>
            ))}
          </div>
          <button
            className={
              "ux-chip ux-spotting" +
              (draft.flow === "spotting" ? " is-active" : "")
            }
            aria-pressed={draft.flow === "spotting"}
            onClick={() => update({ flow: "spotting" })}
          >
            {t("spotting")}
          </button>
        </fieldset>
        <fieldset>
          <legend>
            {t("pain")}
            <output>{draft.pain} / 10</output>
          </legend>
          <input
            aria-label={t("pain")}
            type="range"
            min="0"
            max="10"
            step="1"
            value={draft.pain}
            onChange={(e) => update({ pain: Number(e.target.value) })}
          />
          <div className="ux-range-anchors">
            <span>{t("none")}</span>
            <label>
              <input
                aria-label={t("pain") + " 0–10"}
                type="number"
                min="0"
                max="10"
                value={draft.pain}
                onChange={(e) =>
                  update({
                    pain: Math.min(10, Math.max(0, Number(e.target.value))),
                  })
                }
              />
            </label>
            <span>{t("worst")}</span>
          </div>
        </fieldset>
        <fieldset>
          <legend>{t("symptoms")}</legend>
          <div className="ux-symptom-choices">
            {symptomChoices.slice(0, more ? 4 : 3).map((s) => (
              <button
                key={s.value}
                aria-pressed={draft.symptoms.includes(s.value)}
                className={draft.symptoms.includes(s.value) ? "is-active" : ""}
                onClick={() =>
                  update({
                    symptoms: draft.symptoms.includes(s.value)
                      ? draft.symptoms.filter((x) => x !== s.value)
                      : [...draft.symptoms, s.value],
                  })
                }
              >
                <Icon name={s.icon} />
                {t(s.key)}
              </button>
            ))}
            {!more && (
              <button onClick={() => setMore(true)}>
                <Icon name="plus" />
                {t("more")}
              </button>
            )}
          </div>
        </fieldset>
        <button
          className="ux-text-button"
          onClick={() => setNoteOpen(!noteOpen)}
          aria-expanded={noteOpen}
        >
          <Icon name="edit" />
          {t("addNote")}
        </button>
        {noteOpen && (
          <label>
            {t("note")}
            <textarea
              rows={3}
              maxLength={2000}
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
        )}
        {safety.level !== "routine" && (
          <p className={"ux-alert " + safety.level} role="alert">
            {safety.message}
          </p>
        )}
        {message && (
          <p className="ux-alert" role="alert">
            {message}
          </p>
        )}
        {store.error && (
          <p className="ux-alert" role="alert">
            {t(cycleErrorKey(store.error))}{" "}
            <button
              className="ux-text-button"
              onClick={() => void store.reload()}
            >
              {t("retryCycles")}
            </button>
          </p>
        )}
        <button
          className="ux-btn ux-full"
          disabled={!store.ready || store.busy}
          onClick={save}
        >
          <Icon name="check" />
          {store.busy ? t("loading") : t("save")}
        </button>
        <p className="ux-storage-note">
          <Icon name="lock" size={16} />
          {t("savedAccount")}
        </p>
        <p className="ux-small ux-muted">{t("cycleDraftPrivacy")}</p>
      </div>
    </section>
  );
}
