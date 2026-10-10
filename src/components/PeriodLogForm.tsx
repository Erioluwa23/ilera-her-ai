"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useRouter } from "next/navigation";
import { usePeriodLogs, type Flow, type PeriodLog } from "@/lib/period-store";
import { displayDate, validDate } from "@/lib/health/date-only";
import { periodDuration } from "@/lib/health/cycle-calculations";
import { assessSymptoms } from "@/lib/safety";
import { useLanguage } from "@/lib/use-language";
import { copy, type CopyKey } from "@/lib/ui-copy";
import ConfirmationDialog from "./ConfirmationDialog";
import EnglishContent from "./EnglishContent";
export default function PeriodLogForm({
  initialDate,
  recordId,
  invalidDate = false,
}: {
  initialDate: string;
  recordId?: string;
  invalidDate?: boolean;
}) {
  const router = useRouter();
  const store = usePeriodLogs(),
    { language } = useLanguage(),
    today = useToday();
  const original = recordId
    ? store.logs.find((x) => x.id === recordId)
    : undefined;
  const [date, setDate] = useState(initialDate),
    [end, setEnd] = useState(""),
    [endStatus, setEndStatus] = useState<"ongoing" | "unknown" | "ended">(
      "unknown",
    ),
    [flow, setFlow] = useState<Flow | null>(null),
    [pain, setPain] = useState<number | null>(null),
    [symptoms, setSymptoms] = useState<string[]>([]),
    [uncertain, setUncertain] = useState(false),
    [gapBefore, setGapBefore] = useState(false);
  const [step, setStep] = useState(0),
    [message, setMessage] = useState(
      invalidDate
        ? "The requested date is invalid. Choose a valid start date."
        : "",
    ),
    [saved, setSaved] = useState(false),
    [savedId, setSavedId] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  const loadedId = useRef<string | undefined>(undefined),
    operation = useRef<string>(""),
    active = useRef(false),
    errors = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (original && loadedId.current !== original.id) {
      loadedId.current = original.id;
      setDate(original.startDate);
      setEnd(original.endDate || "");
      setEndStatus(
        original.endDate ? "ended" : original.endStatus || "unknown",
      );
      setFlow(original.flow);
      setPain(original.pain);
      setSymptoms(original.symptoms || []);
      setUncertain(!!original.uncertain);
      setGapBefore(!!original.gapBefore);
      setStep(2);
    }
  }, [original]);
  function fail(value: string) {
    setMessage(value);
    requestAnimationFrame(() => errors.current?.focus());
  }
  function go(next: number) {
    setStep(next);
    setMessage("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function valid() {
    if (
      !validDate(date) ||
      date > today ||
      (end && (!validDate(end) || end > today))
    ) {
      fail("Choose a valid date on or before today.");
      return false;
    }
    if (end && end < date) {
      fail("The end date cannot be before the start.");
      return false;
    }
    const conflict = store.logs.find(
      (x) =>
        x.id !== recordId &&
        x.startDate <= (end || date) &&
        date <= (x.endDate || x.startDate),
    );
    if (conflict) {
      fail(
        "These dates overlap a saved period beginning " +
          displayDate(conflict.startDate, language) +
          ". Open that record to correct it.",
      );
      return false;
    }
    return true;
  }
  async function save() {
    if (active.current || !valid()) return;
    active.current = true;
    setBusy(true);
    setSaved(false);
    operation.current ||= recordId || crypto.randomUUID();
    const record: PeriodLog = {
      ...original,
      id: operation.current,
      startDate: date,
      endDate: end || undefined,
      endStatus,
      flow,
      pain,
      symptoms,
      confirmed: true,
      uncertain,
      gapBefore,
      kind: "period",
      source: original?.source || "tap",
      revision: (original?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    if (await store.upsert(record)) {
      setSavedId(record.id);
      setSaved(true);
      setMessage("");
    } else fail(copy(language, "notSaved"));
    active.current = false;
    setBusy(false);
  }
  const safety =
    pain !== null || flow === "heavy"
      ? assessSymptoms({ pain: pain ?? 0, heavyBleeding: flow === "heavy" })
      : null;
  if (!store.loaded)
    return <p role="status">{store.error || copy(language, "loading")}</p>;
  if (recordId && !original && !saved)
    return (
      <section className="panel">
        <h1>Record unavailable</h1>
        <p>This record was not found in this account’s device storage.</p>
        <Link href="/history">{copy(language, "history")}</Link>
      </section>
    );
  if (saved)
    return (
      <section className="panel">
        <span className="eyebrow">{copy(language, "onDevice")}</span>
        <h1>{copy(language, "periodSaved")}</h1>
        <p>
          {displayDate(date, language)}
          {end ? " – " + displayDate(end, language) : ""}
        </p>
        <div className="screenActions">
          <Link className="btn" href="/cycle">
            {copy(language, "viewTracker")}
          </Link>
          <Link className="secondaryBtn" href={"/log?id=" + savedId}>
            {copy(language, "viewRecord")}
          </Link>
        </div>
      </section>
    );
  return (
    <section className="panel taskPanel">
      <span className="eyebrow">
        {copy(language, "periods")} · {step + 1}/3
      </span>
      <h1 ref={heading} tabIndex={-1}>
        {copy(
          language,
          step === 0 ? "dates" : step === 1 ? "details" : "review",
        )}
      </h1>
      {(message || store.error) && (
        <div ref={errors} tabIndex={-1} className="risk urgent" role="alert">
          <p>{message || store.error}</p>
          <button
            className="textbtn"
            onClick={() => {
              setStep(0);
              requestAnimationFrame(() =>
                document.getElementById("period-start")?.focus(),
              );
            }}
          >
            {copy(language, "startDate")}
          </button>
          <Link href="/history"> · {copy(language, "history")}</Link>
        </div>
      )}
      {step === 0 && (
        <>
          <EnglishContent>
            <p>
              Use the first day of a period you confirm. Spotting,
              pregnancy-related and postpartum bleeding are different records.
            </p>
          </EnglishContent>
          <label>
            {copy(language, "startDate")}
            <input
              id="period-start"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            {copy(language, "endDate")}
            <input
              type="date"
              min={date}
              max={today}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setEndStatus(e.target.value ? "ended" : "unknown");
              }}
            />
          </label>
          <fieldset className="choiceGroup">
            <legend>{copy(language, "endDate")}</legend>
            {(["ongoing", "unknown"] as const).map((x) => (
              <label className="radioChoice" key={x}>
                <input
                  type="radio"
                  name="end-state"
                  checked={!end && endStatus === x}
                  onChange={() => {
                    setEnd("");
                    setEndStatus(x);
                  }}
                />
                {copy(language, x === "ongoing" ? "ongoing" : "unknownEnd")}
              </label>
            ))}
          </fieldset>
          <EnglishContent>
            <label className="checkChoice">
              <input
                type="checkbox"
                checked={uncertain}
                onChange={(e) => setUncertain(e.target.checked)}
              />
              This start date is approximate
            </label>
            <label className="checkChoice">
              <input
                type="checkbox"
                checked={gapBefore}
                onChange={(e) => setGapBefore(e.target.checked)}
              />
              I missed recording a period before this one
            </label>
          </EnglishContent>
          <button
            className="btn"
            onClick={() => {
              if (valid()) go(1);
            }}
          >
            {copy(language, "continue")}
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <fieldset className="choiceGroup">
            <legend>{copy(language, "flow")}</legend>
            {(["spotting", "light", "medium", "heavy"] as Flow[]).map((x) => (
              <label className="radioChoice" key={x}>
                <input
                  type="radio"
                  name="flow"
                  checked={flow === x}
                  onChange={() => setFlow(x)}
                />
                {copy(language, x)}
              </label>
            ))}
            <label className="radioChoice">
              <input
                type="radio"
                name="flow"
                checked={flow === null}
                onChange={() => setFlow(null)}
              />
              {copy(language, "notSure")}
            </label>
          </fieldset>
          <fieldset className="choiceGroup">
            <legend>{copy(language, "pain")}</legend>
            <div className="painChoices">
              {Array.from({ length: 11 }, (_, n) => (
                <label className="radioChoice" key={n}>
                  <input
                    type="radio"
                    name="pain"
                    checked={pain === n}
                    onChange={() => setPain(n)}
                  />
                  {n}
                </label>
              ))}
            </div>
            <label className="radioChoice">
              <input
                type="radio"
                name="pain"
                checked={pain === null}
                onChange={() => setPain(null)}
              />
              {copy(language, "notSure")}
            </label>
          </fieldset>
          <fieldset className="choiceGroup">
            <legend>{copy(language, "symptoms")}</legend>
            {(["tired", "headache", "cramps"] as CopyKey[]).map((x) => (
              <label className="checkChoice" key={x}>
                <input
                  type="checkbox"
                  checked={symptoms.includes(x)}
                  onChange={(e) =>
                    setSymptoms(
                      e.target.checked
                        ? [...symptoms, x]
                        : symptoms.filter((y) => y !== x),
                    )
                  }
                />
                {copy(language, x)}
              </label>
            ))}
          </fieldset>
          <div className="screenActions">
            <button className="secondaryBtn" onClick={() => go(0)}>
              {copy(language, "back")}
            </button>
            <button className="btn" onClick={() => go(2)}>
              {copy(language, "continue")}
            </button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <dl className="reviewSummary">
            <dt>{copy(language, "dates")}</dt>
            <dd>
              {displayDate(date, language)}
              {end
                ? " – " + displayDate(end, language)
                : " · " +
                  copy(
                    language,
                    endStatus === "ongoing" ? "ongoing" : "unknownEnd",
                  )}
              <button
                className="textbtn"
                onClick={() => go(0)}
                aria-label={
                  copy(language, "change") + " · " + copy(language, "dates")
                }
              >
                {copy(language, "change")}
              </button>
            </dd>
            <dt>{copy(language, "details")}</dt>
            <dd>
              {flow ? copy(language, flow) : copy(language, "notProvided")} ·{" "}
              {pain === null ? copy(language, "notProvided") : pain + "/10"}
              <button
                className="textbtn"
                onClick={() => go(1)}
                aria-label={
                  copy(language, "change") + " · " + copy(language, "details")
                }
              >
                {copy(language, "change")}
              </button>
            </dd>
            {end && (
              <>
                <dt>Duration</dt>
                <dd>{periodDuration(date, end)} days</dd>
              </>
            )}
            {original?.notes && (
              <>
                <dt>Legacy note</dt>
                <dd>{original.notes}</dd>
              </>
            )}
          </dl>
          <p>{copy(language, "onDevice")}</p>
          <button className="btn fullWidth" disabled={busy} onClick={save}>
            {copy(
              language,
              busy ? "saving" : recordId ? "saveChanges" : "savePeriod",
            )}
          </button>
          {recordId && (
            <button
              className="textbtn danger"
              onClick={() => setDeleting(true)}
            >
              {copy(language, "delete")}
            </button>
          )}
        </>
      )}
      {safety && safety.level !== "routine" && (
        <EnglishContent>
          <div className={"risk " + safety.level}>
            <strong>{safety.message}</strong>
            <p>
              <Link href="/help#care">{copy(language, "urgentHelp")}</Link>
            </p>
          </div>
        </EnglishContent>
      )}
      {deleting && (
        <ConfirmationDialog
          title={copy(language, "delete") + " · " + displayDate(date, language)}
          confirmLabel={copy(language, "delete")}
          busy={busy}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setBusy(true);
            if (await store.remove(recordId!)) router.push("/history");
            setBusy(false);
          }}
        >
          <p>
            Delete this period from this account’s records on this device? This
            is permanent.
          </p>
        </ConfirmationDialog>
      )}
    </section>
  );
}
