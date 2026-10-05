"use client";
import { useState } from "react";
import Link from "next/link";
import { usePeriodLogs, type Flow } from "@/lib/period-store";
import { includesDate, validDate } from "@/lib/calendar";
import { assessSymptoms } from "@/lib/safety";
export default function PeriodLogForm({
  initialDate,
}: {
  initialDate: string;
}) {
  const store = usePeriodLogs();
  const [date, setDate] = useState(initialDate),
    [end, setEnd] = useState("");
  const [flow, setFlow] = useState<Flow>("medium"),
    [pain, setPain] = useState(3),
    [symptoms, setSymptoms] = useState<string[]>([]);
  const [message, setMessage] = useState(""),
    [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const existing = store.logs.find((x) => includesDate(x, date));
  const safety = assessSymptoms({ pain, heavyBleeding: flow === "heavy" });
  function save() {
    setSaved(false);
    setMessage("");
    if (!validDate(date) || (end && !validDate(end))) {
      setMessage("Choose a valid date.");
      return;
    }
    if (end && end < date) {
      setMessage("The end date cannot be before the start.");
      return;
    }
    if (
      store.logs.some(
        (x) =>
          x.id !== editingId &&
          x.startDate <= (end || date) &&
          date <= (x.endDate || x.startDate),
      )
    ) {
      setMessage(
        "These dates overlap a saved period. Edit the existing record or choose different dates.",
      );
      return;
    }
    if (
      store.persist([
        ...store.logs.filter((x) => x.id !== editingId),
        {
          ...store.logs.find((x) => x.id === editingId),
          id: editingId ?? crypto.randomUUID(),
          startDate: date,
          endDate: end || undefined,
          flow,
          pain,
          symptoms,
        },
      ])
    )
      setSaved(true);
  }
  return (
    <section className="panel formScreen">
      <span className="eyebrow">Save a period log</span>
      <h1>How are you feeling?</h1>
      <p className="muted">Tap your choices. No typing needed.</p>
      <div className="formgrid">
        <label>
          Period start
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Period end (optional)
          <input
            type="date"
            min={date}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <fieldset className="choiceGroup">
        <legend>Bleeding</legend>
        {(["spotting", "light", "medium", "heavy"] as Flow[]).map((x) => (
          <button
            type="button"
            key={x}
            aria-pressed={flow === x}
            className={flow === x ? "languageChoice active" : "languageChoice"}
            onClick={() => setFlow(x)}
          >
            {x}
          </button>
        ))}
      </fieldset>
      <label>
        Pain: {pain}/10
        <input
          type="range"
          min="0"
          max="10"
          value={pain}
          onChange={(e) => setPain(Number(e.target.value))}
        />
      </label>
      <fieldset className="choiceGroup">
        <legend>Other symptoms (optional)</legend>
        {["Tired", "Headache", "Cramps"].map((x) => (
          <button
            type="button"
            key={x}
            aria-pressed={symptoms.includes(x)}
            className={
              symptoms.includes(x) ? "languageChoice active" : "languageChoice"
            }
            onClick={() =>
              setSymptoms((v) =>
                v.includes(x) ? v.filter((s) => s !== x) : [...v, x],
              )
            }
          >
            {x}
          </button>
        ))}
      </fieldset>
      <div className={"risk " + safety.level}>{safety.message}</div>
      {(message || store.error) && (
        <p role="alert" className="risk attention">
          {message || store.error}
        </p>
      )}
      <button className="btn fullWidth" onClick={save}>
        {editingId ? "Update log →" : "Save log →"}
      </button>
      <p className="muted small">
        Saved only in this browser. No internet needed to save.
      </p>
      {saved && (
        <div role="status" className="risk routine">
          Your period log is saved. <Link href="/cycle">View calendar →</Link>
        </div>
      )}
      {existing && (
        <div className="selectedDay">
          <h2>Saved record</h2>
          <p>
            {existing.startDate}
            {existing.endDate ? " to " + existing.endDate : ""} ·{" "}
            {existing.flow} flow · Pain {existing.pain}/10
          </p>
          <button
            className="secondaryBtn"
            onClick={() => {
              setEditingId(existing.id);
              setDate(existing.startDate);
              setEnd(existing.endDate || "");
              setFlow(existing.flow);
              setPain(existing.pain);
              setSymptoms(existing.symptoms || []);
              setSaved(false);
              setMessage("");
            }}
          >
            Edit saved choices
          </button>
          <button
            className="textbtn danger"
            onClick={() => {
              if (window.confirm("Remove this period log?")) {
                store.persist(store.logs.filter((x) => x.id !== existing.id));
                setEditingId(null);
                setSaved(false);
              }
            }}
          >
            Remove this log
          </button>
          <Link className="textlink" href="/history">
            View history
          </Link>
        </div>
      )}
      <Link className="secondaryBtn linkbtn" href="/voice" prefetch={false}>
        🎙 Speak about symptoms
      </Link>
    </section>
  );
}
