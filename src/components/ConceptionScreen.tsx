"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useHealthData } from "@/lib/health-store";
import type { Conception } from "@/lib/health/records";
import { validDate, displayDate } from "@/lib/health/date-only";
import { conceptionFacts } from "@/lib/health/timing-calculations";
import EnglishContent from "./EnglishContent";
const CHECKLIST = [
  "Discuss health preparation with a provider",
  "Discuss current medicines with a professional",
  "Prepare questions about fertility concerns",
];
export default function ConceptionScreen({ recordId }: { recordId?: string }) {
  const store = useHealthData(),
    original = store.data.conception.find((x) => x.id === recordId),
    [date, setDate] = useState(""),
    [pauses, setPauses] = useState<Conception["pauses"]>("unknown"),
    [checked, setChecked] = useState<string[]>([]),
    [review, setReview] = useState(false),
    [editing, setEditing] = useState(false),
    [id, setId] = useState(recordId),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const current = store.data.conception.find((x) => x.id === id) || original,
    today = useToday(),
    facts = current
      ? conceptionFacts(
          current.startDate,
          undefined,
          today,
          current.checked.length,
          CHECKLIST.length,
        )
      : null;
  function start(record?: Conception) {
    setDate(record?.startDate || "");
    setPauses(record?.pauses || "unknown");
    setChecked(record?.checked || []);
    setId(record?.id || crypto.randomUUID());
    setReview(false);
    setEditing(true);
  }
  async function save() {
    if (!id || lock.current) return;
    lock.current = true;
    setBusy(true);
    const next: Conception = {
      id,
      startDate: date,
      pauses,
      checked,
      changes: [
        ...(current?.changes || []),
        { at: new Date().toISOString(), startDate: date },
      ],
    };
    if (
      await store.commit((data) => ({
        ...data,
        conception: [...data.conception.filter((x) => x.id !== id), next],
      }))
    ) {
      setEditing(false);
      setMessage("Trying-start date and checklist saved on this device.");
    }
    lock.current = false;
    setBusy(false);
  }
  if (!store.loaded)
    return <p role="status">{store.error || "Opening records…"}</p>;
  return (
    <section className="panel taskPanel">
      <h1>Trying to conceive</h1>
      <EnglishContent>
        <p className="pill">
          Records only · referral policy and content review pending
        </p>
        <p>
          Record your own start date and discussion checklist. Progress is not a
          probability of pregnancy. You can discuss concerns with a provider at
          any time.
        </p>
        {message && <p role="status">{message}</p>}
        {store.error && <p role="alert">{store.error}</p>}
        {!editing && (
          <>
            <button className="btn" onClick={() => start()}>
              Add a trying-start record
            </button>
            {store.data.conception.map((x) => (
              <p key={x.id}>
                <button className="textbtn" onClick={() => setId(x.id)}>
                  {displayDate(x.startDate)}
                </button>
              </p>
            ))}
            {current && facts && (
              <div className="selectedDay">
                <h2>Since your recorded start</h2>
                <p>
                  {facts.months} completed calendar months since{" "}
                  {displayDate(current.startDate)}.
                </p>
                <p>
                  Long pauses: {current.pauses}. Pauses are not silently
                  subtracted from elapsed time.
                </p>
                <p>
                  Discussion checklist: {current.checked.length}/
                  {CHECKLIST.length} selected actions completed.
                </p>
                <p>
                  No age-specific referral threshold or conception likelihood is
                  published.
                </p>
                <button className="secondaryBtn" onClick={() => start(current)}>
                  Edit record
                </button>
              </div>
            )}
          </>
        )}
        {editing &&
          (review ? (
            <div className="selectedDay">
              <h2>Review before saving</h2>
              <p>
                Start: {displayDate(date)} · Long pauses: {pauses}
              </p>
              <ul>
                {checked.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <button className="secondaryBtn" onClick={() => setReview(false)}>
                Change
              </button>
              <button className="btn" disabled={busy} onClick={save}>
                Save record
              </button>
            </div>
          ) : (
            <div className="taskPanel">
              <label>
                When did you start trying?
                <input
                  type="date"
                  max={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Does this period include long pauses?
                <select
                  value={pauses}
                  onChange={(e) => setPauses(e.target.value as typeof pauses)}
                >
                  <option value="unknown">Not sure</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <fieldset className="choiceGroup">
                <legend>Discussion checklist (optional)</legend>
                {CHECKLIST.map((x) => (
                  <label className="checkChoice" key={x}>
                    <input
                      type="checkbox"
                      checked={checked.includes(x)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? [...checked, x]
                            : checked.filter((y) => y !== x),
                        )
                      }
                    />
                    {x}
                  </label>
                ))}
              </fieldset>
              <button
                className="btn"
                onClick={() => {
                  if (validDate(date) && date <= today) {
                    setReview(true);
                    setMessage("");
                  } else
                    setMessage(
                      "Choose a confirmed start date on or before today.",
                    );
                }}
              >
                Review before saving
              </button>
              <button className="textbtn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          ))}
        <Link className="secondaryBtn" href="/help#care">
          Discuss concerns with a provider
        </Link>
        <Link href="/fertility">Fertility information</Link>
      </EnglishContent>
    </section>
  );
}
