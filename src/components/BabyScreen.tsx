"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useHealthData } from "@/lib/health-store";
import type { Baby } from "@/lib/health/records";
import { babyAge } from "@/lib/health/baby-calculations";
import { validDate, displayDate } from "@/lib/health/date-only";
import EnglishContent from "./EnglishContent";
export default function BabyScreen({ recordId }: { recordId?: string }) {
  const store = useHealthData(),
    [selected, setSelected] = useState(recordId || ""),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [sex, setSex] = useState<Baby["referenceSex"]>("unknown"),
    [term, setTerm] = useState<Baby["term"]>("unknown"),
    [weeks, setWeeks] = useState(""),
    [extra, setExtra] = useState(""),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    operation = useRef(""),
    today = useToday(),
    baby = store.data.babies.find((b) => b.id === selected);
  function start(b?: Baby) {
    setSelected(b?.id || "");
    setName(b?.name || "");
    setBirthDate(b?.birthDate || "");
    setSex(b?.referenceSex || "unknown");
    setTerm(b?.term || "unknown");
    setWeeks(b?.birthWeeks?.toString() || "");
    setExtra(b?.birthExtraDays?.toString() || "");
    setReview(false);
    setEditing(true);
    operation.current = b?.id || crypto.randomUUID();
  }
  function validate() {
    if (!validDate(birthDate) || birthDate > today) {
      setMessage("Choose the actual birth date on or before today.");
      return false;
    }
    if (
      (weeks &&
        (!Number.isInteger(Number(weeks)) ||
          Number(weeks) < 0 ||
          Number(weeks) > 45)) ||
      (extra &&
        (!Number.isInteger(Number(extra)) ||
          Number(extra) < 0 ||
          Number(extra) > 6))
    ) {
      setMessage("Check gestational weeks and additional days (0–6).");
      return false;
    }
    setMessage("");
    return true;
  }
  async function save() {
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    const b: Baby = {
      id: operation.current,
      name: name.trim(),
      birthDate,
      referenceSex: sex,
      term,
      ...(weeks ? { birthWeeks: Number(weeks) } : {}),
      ...(extra ? { birthExtraDays: Number(extra) } : {}),
    };
    if (
      await store.commit((current) => ({
        ...current,
        babies: [...current.babies.filter((x) => x.id !== b.id), b],
      }))
    ) {
      setSelected(b.id);
      setEditing(false);
      setMessage("Child profile saved on this device.");
    }
    lock.current = false;
    setBusy(false);
  }
  if (!store.loaded)
    return <p role="status">{store.error || "Opening child profiles…"}</p>;
  return (
    <section className="panel taskPanel">
      <h1>Baby care records</h1>
      <EnglishContent>
        <p className="pill">
          Record-only · newborn and maternal content review pending
        </p>
        <p>
          You can create a child profile without a pregnancy record. A due date
          is never used as a birth date.
        </p>
        {message && (
          <p role="status" className="statusBox">
            {message}
          </p>
        )}
        {store.error && <p role="alert">{store.error}</p>}
        {!editing && (
          <>
            <button className="btn" onClick={() => start()}>
              Add a child profile / record a birth
            </button>
            <label>
              Choose a child
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose a profile</option>
                {store.data.babies.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name || "Unnamed child"} · {displayDate(x.birthDate)}
                  </option>
                ))}
              </select>
            </label>
            {baby && (
              <article className="selectedDay">
                <h2>{baby.name || "Child profile"}</h2>
                <p>
                  Born {displayDate(baby.birthDate)} ·{" "}
                  {babyAge(baby.birthDate, today).days} days old today
                </p>
                <p>
                  Birth status: {baby.term} · Chart reference:{" "}
                  {baby.referenceSex}
                </p>
                <p>
                  Age arithmetic describes dates; no milestone or growth
                  assessment is made.
                </p>
                <button className="secondaryBtn" onClick={() => start(baby)}>
                  Edit profile
                </button>
                <Link className="secondaryBtn" href="/growth">
                  Add a measurement
                </Link>
                <Link className="textlink" href="/history">
                  Manage or delete profile
                </Link>
              </article>
            )}
          </>
        )}
        {editing &&
          (review ? (
            <div className="selectedDay">
              <h2>Review child profile</h2>
              <p>Name: {name || "Not provided"}</p>
              <p>Actual birth date: {displayDate(birthDate)}</p>
              <p>
                Reference sex: {sex} · Birth status: {term}
              </p>
              <p>
                Gestational age at birth: {weeks || "Unknown"} weeks,{" "}
                {extra || "Unknown"} extra days
              </p>
              <p>
                This creates or updates only this child’s record. Other children
                and pregnancy records remain separate.
              </p>
              <button className="secondaryBtn" onClick={() => setReview(false)}>
                Change
              </button>
              <button className="btn" disabled={busy} onClick={save}>
                Save child profile
              </button>
            </div>
          ) : (
            <div className="taskPanel">
              <label>
                Display name (optional)
                <input
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label>
                Actual birth date
                <input
                  type="date"
                  max={today}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </label>
              <label>
                Chart reference sex (optional)
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as typeof sex)}
                >
                  <option value="unknown">
                    Unknown / prefer not to provide
                  </option>
                  <option value="female">Female reference</option>
                  <option value="male">Male reference</option>
                </select>
              </label>
              <p>
                This classification selects a growth reference when comparisons
                are validated. It is not inferred from a name and is separate
                from gender identity.
              </p>
              <label>
                Birth status
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value as typeof term)}
                >
                  <option value="unknown">Not sure</option>
                  <option value="term">Confirmed term birth</option>
                  <option value="preterm">Preterm birth</option>
                </select>
              </label>
              {term === "preterm" && (
                <>
                  <label>
                    Gestational weeks at birth (optional)
                    <input
                      type="number"
                      value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                    />
                  </label>
                  <label>
                    Additional days at birth (0–6, optional)
                    <input
                      type="number"
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button
                className="btn"
                onClick={() => {
                  if (validate()) setReview(true);
                }}
              >
                Review before saving
              </button>
              <button className="textbtn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          ))}
        <div className="notice">
          <h2>Caregiver or maternal concern?</h2>
          <p>
            For current severe or worrying symptoms, seek in-person medical
            care. Do not wait for a saved profile or an AI answer.
          </p>
          <Link className="secondaryBtn" href="/help#care">
            Get healthcare help
          </Link>
        </div>
      </EnglishContent>
    </section>
  );
}
