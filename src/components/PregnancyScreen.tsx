"use client";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useRef, useState } from "react";
import { useHealthData } from "@/lib/health-store";
import type { Pregnancy } from "@/lib/health/records";
import { pregnancyDates } from "@/lib/health/pregnancy-calculations";
import { validDate, displayDate } from "@/lib/health/date-only";
import { recordResult } from "@/lib/health/record-result";
import HealthResultCard from "./HealthResultCard";
import EnglishContent from "./EnglishContent";
export default function PregnancyScreen({ recordId }: { recordId?: string }) {
  const store = useHealthData(),
    original = store.data.pregnancies.find((p) => p.id === recordId),
    [editing, setEditing] = useState(!recordId),
    [method, setMethod] = useState<"provider" | "lmp" | "unknown">("unknown"),
    [date, setDate] = useState(""),
    [regular, setRegular] = useState("unknown"),
    [reliable, setReliable] = useState("unknown"),
    [usualLength, setUsualLength] = useState(""),
    [status, setStatus] = useState<Pregnancy["status"]>("active"),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedId, setSelectedId] = useState(recordId),
    [appointment, setAppointment] = useState(false),
    [appointmentDate, setAppointmentDate] = useState(""),
    [appointmentTime, setAppointmentTime] = useState(""),
    [appointmentReview, setAppointmentReview] = useState(false);
  const operation = useRef(""),
    lock = useRef(false),
    today = useToday(),
    selected = store.data.pregnancies.find((x) => x.id === selectedId);
  function edit(p: Pregnancy) {
    setSelectedId(p.id);
    setMethod(p.clinicianEDD ? "provider" : p.lmp ? "lmp" : "unknown");
    setDate(p.clinicianEDD || p.lmp || "");
    setStatus(p.status);
    setRegular(
      p.regular === true ? "yes" : p.regular === false ? "no" : "unknown",
    );
    setReliable(
      p.reliable === true ? "yes" : p.reliable === false ? "no" : "unknown",
    );
    setUsualLength(p.usualLength?.toString() || "");
    setReview(false);
    setEditing(true);
  }
  function validate() {
    if (
      method !== "unknown" &&
      (!validDate(date) || (method === "lmp" && date > today))
    ) {
      setMessage("Choose a valid date. A last period cannot be in the future.");
      return false;
    }
    if (
      usualLength &&
      (!Number.isInteger(Number(usualLength)) ||
        Number(usualLength) < 1 ||
        Number(usualLength) > 120)
    ) {
      setMessage("Check the usual cycle length.");
      return false;
    }
    setMessage("");
    return true;
  }
  async function save() {
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    operation.current ||= selected?.id || crypto.randomUUID();
    const providerEDD = method === "provider" ? date : selected?.clinicianEDD;
    const next: Pregnancy = {
      id: operation.current,
      status,
      clinicianEDD: providerEDD,
      lmp: method === "lmp" ? date : selected?.lmp,
      reliable: reliable === "unknown" ? null : reliable === "yes",
      regular: regular === "unknown" ? null : regular === "yes",
      usualLength: usualLength ? Number(usualLength) : null,
      updatedAt: new Date().toISOString(),
      changes: [
        ...(selected?.changes || []),
        {
          at: new Date().toISOString(),
          oldEDD: selected?.clinicianEDD || null,
          newEDD: providerEDD || null,
          basis: method,
        },
      ],
    };
    if (
      await store.commit((current) => ({
        ...current,
        pregnancies: [
          ...current.pregnancies.filter((p) => p.id !== next.id),
          next,
        ],
      }))
    ) {
      setSelectedId(next.id);
      setEditing(false);
      setReview(false);
      setMessage("Pregnancy details saved on this device.");
      operation.current = "";
    }
    lock.current = false;
    setBusy(false);
  }
  const dating = selected
    ? pregnancyDates({ ...selected, lmp: undefined }, today)
    : null;
  const result = selected
    ? recordResult(
        "pregnancy",
        "provider-edd-280-anchor-v1",
        [selected.id],
        dating?.status === "ready"
          ? [
              {
                id: "weeks",
                value: dating.weeks!,
                unit: "weeks",
                displayToken:
                  dating.weeks + " weeks, " + dating.extraDays + " days",
                basis: "How far along, from your provider’s due date",
                estimated: true,
              },
              {
                id: "edd",
                value: dating.edd!,
                unit: null,
                displayToken: displayDate(dating.edd!),
                basis: "You entered a due date supplied by your provider",
                estimated: true,
              },
            ]
          : [],
        selected.status !== "active"
          ? "Tracking is " +
              selected.status +
              ". Weekly cards and prompts are paused."
          : dating?.status === "needs_confirmation"
            ? "Please confirm the dating information with your maternity team. No countdown is shown."
            : dating?.edd
              ? "This is date arithmetic from the due date you entered. The provider source has not been electronically verified."
              : "No due date is calculated. Your record stays available while dating and care policies await review.",
        [
          "LMP estimates, adjusted cycles, care schedules and stage guidance await local clinical review.",
        ],
      )
    : null;
  if (!store.loaded)
    return <p role="status">{store.error || "Opening records…"}</p>;
  return (
    <section className="panel taskPanel">
      <h1>Pregnancy records</h1>
      <EnglishContent>
        <p className="pill">Record-only · care and dating review pending</p>
        <p>
          A focus or a positive test does not create a pregnancy record. Add
          details only when you choose. A provider date is preserved when period
          records change.
        </p>
        {message && (
          <p className="statusBox" role="status">
            {message}
          </p>
        )}
        {store.error && (
          <p role="alert" className="risk urgent">
            {store.error}
          </p>
        )}
        {!editing && (
          <>
            <div className="screenActions">
              <button
                className="btn"
                onClick={() => {
                  setSelectedId(undefined);
                  setDate("");
                  setMethod("unknown");
                  setStatus("active");
                  setRegular("unknown");
                  setReliable("unknown");
                  setUsualLength("");
                  setEditing(true);
                }}
              >
                Add pregnancy details
              </button>
            </div>
            {store.data.pregnancies.map((p) => (
              <p key={p.id}>
                <button className="textbtn" onClick={() => setSelectedId(p.id)}>
                  {p.clinicianEDD
                    ? displayDate(p.clinicianEDD)
                    : "Unknown due date"}{" "}
                  · {p.status}
                </button>
              </p>
            ))}
            {selected && result && (
              <>
                <HealthResultCard title="Pregnancy overview" result={result} />
                <button className="secondaryBtn" onClick={() => edit(selected)}>
                  Update details or pause/end tracking
                </button>
                <details>
                  <summary>Dating change history</summary>
                  {selected.changes.map((c, i) => (
                    <p key={i}>
                      {c.at.slice(0, 10)} · {c.oldEDD || "Unknown"} →{" "}
                      {c.newEDD || "Unknown"} · {c.basis}
                    </p>
                  ))}
                </details>
                <button
                  className="secondaryBtn"
                  onClick={() => setAppointment(!appointment)}
                >
                  Add a saved appointment
                </button>
                <Link className="textlink" href="/baby">
                  Record a birth / create a child profile
                </Link>
                <p>
                  Creating a child profile is a separate confirmation. It does
                  not end or delete this pregnancy.
                </p>
              </>
            )}
            {original && !selected && <p>Choose this record from the list.</p>}
          </>
        )}
        {editing &&
          (review ? (
            <div className="selectedDay">
              <h2>Review pregnancy details</h2>
              <p>
                Dating information: {method} ·{" "}
                {date ? displayDate(date) : "Unknown"}
              </p>
              {selected?.clinicianEDD && method !== "provider" && (
                <p>
                  Your provider’s due date {displayDate(selected.clinicianEDD)}{" "}
                  will remain selected. Adding an LMP does not replace it.
                </p>
              )}
              <p>Status: {status}</p>
              <p>
                Regularity: {regular}; reliable last period: {reliable}; usual
                cycle length: {usualLength || "Not provided"}
              </p>
              <button className="secondaryBtn" onClick={() => setReview(false)}>
                Change
              </button>
              <button className="btn" disabled={busy} onClick={save}>
                Save pregnancy details
              </button>
            </div>
          ) : (
            <div className="taskPanel">
              <label>
                Dating information
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as typeof method);
                    setDate("");
                  }}
                >
                  <option value="unknown">I do not know</option>
                  <option value="provider">
                    A due date given by my healthcare provider
                  </option>
                  <option value="lmp">
                    First day of my last period (record only)
                  </option>
                </select>
              </label>
              {method !== "unknown" && (
                <label>
                  {method === "provider"
                    ? "Provider-supplied due date"
                    : "First day of last period"}
                  <input
                    type="date"
                    max={method === "lmp" ? today : undefined}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
              {method === "lmp" && (
                <>
                  <label>
                    Are your usual cycles regular?
                    <select
                      value={regular}
                      onChange={(e) => setRegular(e.target.value)}
                    >
                      <option value="unknown">Not sure</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label>
                    Is this last-period date reliable?
                    <select
                      value={reliable}
                      onChange={(e) => setReliable(e.target.value)}
                    >
                      <option value="unknown">Not sure</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label>
                    Usual cycle length (optional, days)
                    <input
                      type="number"
                      value={usualLength}
                      onChange={(e) => setUsualLength(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                Tracking status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="active">Active</option>
                  <option value="paused">Pause this tracking</option>
                  <option value="ended">End this tracking record</option>
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
        {appointment && selected && (
          <div className="selectedDay">
            <h2>Saved appointment</h2>
            {appointmentReview ? (
              <>
                <p>
                  {displayDate(appointmentDate)} at {appointmentTime} ·
                  Africa/Lagos
                </p>
                <p>
                  This records an appointment; the app does not book or contact
                  a provider or guarantee a notification.
                </p>
                <button
                  className="secondaryBtn"
                  onClick={() => setAppointmentReview(false)}
                >
                  Change
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    if (lock.current) return;
                    lock.current = true;
                    setBusy(true);
                    const id = crypto.randomUUID();
                    if (
                      await store.commit((current) => ({
                        ...current,
                        appointments: [
                          ...current.appointments,
                          {
                            id,
                            pregnancyId: selected.id,
                            date: appointmentDate,
                            time: appointmentTime,
                            timezone: "Africa/Lagos",
                          },
                        ],
                      }))
                    ) {
                      setAppointment(false);
                      setAppointmentReview(false);
                      setMessage("Appointment saved on this device.");
                    }
                    lock.current = false;
                    setBusy(false);
                  }}
                >
                  Save appointment
                </button>
              </>
            ) : (
              <>
                <label>
                  Appointment date
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                  />
                </label>
                <label>
                  Time (Africa/Lagos)
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                  />
                </label>
                <button
                  className="btn"
                  onClick={() => {
                    if (validDate(appointmentDate) && appointmentTime)
                      setAppointmentReview(true);
                    else setMessage("Choose an appointment date and time.");
                  }}
                >
                  Review appointment
                </button>
              </>
            )}
          </div>
        )}
        {selected && (
          <ul>
            {store.data.appointments
              .filter((x) => x.pregnancyId === selected.id)
              .map((x) => (
                <li key={x.id}>
                  {displayDate(x.date)} · {x.time} · {x.timezone}
                </li>
              ))}
          </ul>
        )}
        <Link className="textlink" href="/help#care">
          Get healthcare help
        </Link>
      </EnglishContent>
    </section>
  );
}
