"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useEffect, useRef, useState } from "react";
import { useHealthData } from "@/lib/health-store";
import type { Measurement } from "@/lib/health/records";
import { validDate, displayDate } from "@/lib/health/date-only";
import {
  babyAge,
  weightKg,
  lengthCm,
  weightChange,
} from "@/lib/health/baby-calculations";
import { recordResult } from "@/lib/health/record-result";
import HealthResultCard from "./HealthResultCard";
import EnglishContent from "./EnglishContent";
const MeasurementPlot = dynamic(() => import("./MeasurementPlot"), {
  loading: () => <p role="status">Opening plot…</p>,
});
export default function GrowthScreen({ recordId }: { recordId?: string }) {
  const store = useHealthData(),
    today = useToday(),
    original = store.data.measurements.find((x) => x.id === recordId),
    [child, setChild] = useState(""),
    [editing, setEditing] = useState(false),
    [date, setDate] = useState(today),
    [measure, setMeasure] = useState<Measurement["measure"]>("weight"),
    [value, setValue] = useState(""),
    [unit, setUnit] = useState(""),
    [method, setMethod] = useState<Measurement["method"]>("unknown"),
    [source, setSource] = useState<Measurement["source"]>("unknown"),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [plot, setPlot] = useState(false),
    [editingId, setEditingId] = useState<string>();
  const lock = useRef(false),
    operation = useRef(""),
    loadedId = useRef<string | null>(null),
    baby = store.data.babies.find((x) => x.id === child),
    units = measure === "weight" ? ["kg", "g", "lb"] : ["cm", "mm", "in"];
  useEffect(() => {
    if (original && loadedId.current !== original.id) {
      loadedId.current = original.id;
      setChild(original.babyId);
      setDate(original.date);
      setMeasure(original.measure);
      setValue(String(original.value));
      setUnit(original.unit);
      setMethod(original.method);
      setSource(original.source);
      setEditingId(original.id);
      operation.current = original.id;
      setEditing(true);
    }
  }, [original]);
  function start(m?: Measurement) {
    setDate(m?.date || today);
    setMeasure(m?.measure || "weight");
    setValue(m?.value.toString() || "");
    setUnit(m?.unit || "");
    setMethod(m?.method || "unknown");
    setSource(m?.source || "unknown");
    setEditingId(m?.id);
    operation.current = m?.id || crypto.randomUUID();
    setReview(false);
    setPlot(false);
    setEditing(true);
  }
  function normalized() {
    return measure === "weight"
      ? weightKg(Number(value), unit as "kg" | "g" | "lb")
      : lengthCm(Number(value), unit as "cm" | "mm" | "in");
  }
  function validate() {
    if (
      !baby ||
      !validDate(date) ||
      date > today ||
      date < baby.birthDate ||
      !units.includes(unit) ||
      !value ||
      !Number.isFinite(Number(value)) ||
      Number(value) <= 0
    ) {
      setMessage(
        "Choose the child, a valid measurement date, a positive value and its unit.",
      );
      return false;
    }
    setMessage("");
    return true;
  }
  async function save() {
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    const m: Measurement = {
      id: operation.current,
      babyId: child,
      date,
      measure,
      value: Number(value),
      unit: unit as Measurement["unit"],
      normalized: normalized(),
      method,
      source,
      confirmed: true,
      revision:
        (store.data.measurements.find((x) => x.id === editingId)?.revision ||
          0) + 1,
    };
    if (
      await store.commit((current) => ({
        ...current,
        measurements: [...current.measurements.filter((x) => x.id !== m.id), m],
      }))
    ) {
      setEditing(false);
      setMessage("Measurement saved on this device.");
    }
    lock.current = false;
    setBusy(false);
  }
  const records = store.data.measurements
      .filter((x) => x.babyId === child && x.measure === measure)
      .sort((a, b) => a.date.localeCompare(b.date)),
    latest = records.at(-1),
    earlier = records.at(-2),
    change =
      measure === "weight" && earlier && latest
        ? weightChange(
            { date: earlier.date, kg: earlier.normalized },
            { date: latest.date, kg: latest.normalized },
          )
        : null;
  const result = latest
    ? recordResult(
        "growth",
        "measurement-units-v1",
        [latest.id],
        [
          {
            id: "value",
            value: latest.normalized,
            unit: measure === "weight" ? "kg" : "cm",
            displayToken:
              latest.value +
              " " +
              latest.unit +
              " (" +
              latest.normalized.toLocaleString("en-NG", {
                maximumFractionDigits: 3,
              }) +
              " " +
              (measure === "weight" ? "kg" : "cm") +
              ")",
            basis: "Confirmed measurement on " + displayDate(latest.date),
            estimated: false,
          },
        ],
        "Reference comparisons are unavailable. The recorded measurement remains visible. No percentile, health label or future growth estimate is calculated.",
        [
          "WHO tables, licence, independent oracle, clinical policy and translations need review.",
        ],
      )
    : null;
  if (!store.loaded)
    return <p role="status">{store.error || "Opening growth records…"}</p>;
  return (
    <section className="panel taskPanel">
      <h1>Growth records</h1>
      <EnglishContent>
        <p className="pill">Record-only · reference validation pending</p>
        <label>
          Selected child
          <select
            value={child}
            disabled={editing && !!editingId}
            onChange={(e) => {
              setChild(e.target.value);
              setValue("");
              setUnit("");
              setReview(false);
              setPlot(false);
            }}
          >
            <option value="">Choose a child</option>
            {store.data.babies.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || "Unnamed child"} · {displayDate(b.birthDate)}
              </option>
            ))}
          </select>
        </label>
        {!store.data.babies.length && (
          <p>
            <Link href="/baby">Create a child profile first</Link>
          </p>
        )}
        {baby && (
          <p>
            {baby.name || "Child"} · {babyAge(baby.birthDate, today).days} days
            old today · {baby.term}
          </p>
        )}
        {message && (
          <p role="status" className="statusBox">
            {message}
          </p>
        )}
        {store.error && <p role="alert">{store.error}</p>}
        {!editing && (
          <>
            <label>
              Measurement
              <select
                value={measure}
                onChange={(e) => {
                  setMeasure(e.target.value as typeof measure);
                  setPlot(false);
                }}
              >
                <option value="weight">Weight</option>
                <option value="length">Length / height</option>
                <option value="head">Head circumference</option>
              </select>
            </label>
            <button className="btn" disabled={!baby} onClick={() => start()}>
              Add a measurement
            </button>
            {result && (
              <HealthResultCard
                title={(baby?.name || "Child") + " · latest " + measure}
                result={result}
              />
            )}
            {change && (
              <p>
                Across {change.days} recorded days: {change.grams.toFixed(1)} g
                change ({change.gramsPerDay.toFixed(1)} g/day). This describes
                observations, not feeding adequacy or a diagnosis.
              </p>
            )}
            {earlier && latest && earlier.date === latest.date && (
              <p>
                These observations have the same date. No rate of change is
                calculated.
              </p>
            )}
            {records.length > 0 && (
              <>
                <button className="secondaryBtn" onClick={() => setPlot(!plot)}>
                  {plot ? "Hide" : "Show"} recorded points
                </button>
                {plot && <MeasurementPlot records={records} />}
                <div
                  className="tableRegion"
                  role="region"
                  aria-label="Measurement records"
                  tabIndex={0}
                >
                  <table className="recordTable">
                    <caption>
                      {baby?.name || "Child"} · {measure} records
                    </caption>
                    <thead>
                      <tr>
                        <th>Date / age</th>
                        <th>Original</th>
                        <th>Method/source</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((m) => (
                        <tr key={m.id}>
                          <td>
                            {displayDate(m.date)}
                            <br />
                            {babyAge(baby!.birthDate, m.date).days} days
                          </td>
                          <td>
                            {m.value} {m.unit}
                          </td>
                          <td>
                            {m.method} / {m.source}
                          </td>
                          <td>
                            <button
                              className="textbtn"
                              onClick={() => start(m)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        {editing &&
          (review ? (
            <div className="selectedDay">
              <h2>Review measurement</h2>
              <p>
                Child: {baby?.name || "Unnamed child"} · born{" "}
                {baby && displayDate(baby.birthDate)}
              </p>
              <p>
                {displayDate(date)} · {measure}: {value} {unit} →{" "}
                {normalized().toLocaleString("en-NG", {
                  maximumFractionDigits: 4,
                })}{" "}
                {measure === "weight" ? "kg" : "cm"}
              </p>
              <p>
                Method: {method} · Source: {source}
              </p>
              <p>
                Please check the value, unit and selected child. Same-date
                entries are kept as separate records unless you explicitly edit
                one.
              </p>
              <button className="secondaryBtn" onClick={() => setReview(false)}>
                Change
              </button>
              <button className="btn" disabled={busy} onClick={save}>
                {editingId ? "Save changes" : "Save measurement"}
              </button>
            </div>
          ) : (
            <div className="taskPanel">
              <label>
                Measurement date
                <input
                  type="date"
                  min={baby?.birthDate}
                  max={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Measure
                <select
                  value={measure}
                  onChange={(e) => {
                    setMeasure(e.target.value as typeof measure);
                    setUnit("");
                    setValue("");
                    setMethod("unknown");
                  }}
                >
                  <option value="weight">Weight</option>
                  <option value="length">Length / height</option>
                  <option value="head">Head circumference</option>
                </select>
              </label>
              <label>
                Value
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <label>
                Unit
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="">Choose a unit</option>
                  {units.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Measurement method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  <option value="unknown">Not sure</option>
                  {(measure === "weight"
                    ? ["scale"]
                    : measure === "length"
                      ? ["recumbent", "standing"]
                      : ["tape"]
                  ).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Source
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                >
                  <option value="unknown">Not provided</option>
                  <option value="home">Measured at home</option>
                  <option value="provider">Measured by a provider</option>
                </select>
              </label>
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
        <Link className="textlink" href="/history">
          Share selected records or delete a measurement
        </Link>
        <Link className="textlink" href="/help#care">
          Get healthcare help
        </Link>
      </EnglishContent>
    </section>
  );
}
