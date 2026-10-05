"use client";
import { useEffect, useMemo, useState } from "react";
import { assessSymptoms } from "@/lib/safety";
import { averageCycleLength, predictedNextPeriod } from "@/lib/cycle";

type Flow = "spotting" | "light" | "medium" | "heavy";
type PeriodLog = {
  id: string;
  startDate: string;
  endDate?: string;
  flow: Flow;
  pain: number;
  notes?: string;
};
type LegacyLog = { date: string; flow: Flow; pain: number; notes?: string };
const KEY = "ileraher-periods-v2";
const LEGACY_KEY = "ileraher-cycle-v1";

function load(): PeriodLog[] {
  if (typeof window === "undefined") return [];
  try {
    const current = JSON.parse(
      localStorage.getItem(KEY) || "[]",
    ) as PeriodLog[];
    if (current.length) return current;
    const legacy = JSON.parse(
      localStorage.getItem(LEGACY_KEY) || "[]",
    ) as LegacyLog[];
    if (!legacy.length) return [];
    const migrated = legacy.map((x, i) => ({
      id: "legacy-" + i + "-" + x.date,
      startDate: x.date,
      flow: x.flow,
      pain: x.pain,
      notes: x.notes,
    }));
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

export default function Tracker() {
  const [logs, setLogs] = useState<PeriodLog[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // Browser-only records must be read after hydration, never during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogs(load());
  }, []);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [flow, setFlow] = useState<Flow>("medium");
  const [pain, setPain] = useState(3);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const starts = useMemo(() => logs.map((x) => x.startDate), [logs]);
  const safety = assessSymptoms({ pain, heavyBleeding: flow === "heavy" });

  function persist(v: PeriodLog[]) {
    const sorted = [...v].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
    try {
      localStorage.setItem(KEY, JSON.stringify(sorted));
      setLogs(sorted);
      return true;
    } catch {
      setFormError(
        "Your browser could not save this record. Check that local storage is enabled.",
      );
      return false;
    }
  }

  function save() {
    setFormError("");
    setSaved(false);
    if (!startDate) {
      setFormError("Choose the first day of this period.");
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError("Period end cannot be before period start.");
      return;
    }
    if (logs.some((x) => x.startDate === startDate)) {
      setFormError(
        "A period with this start date is already saved. Remove it first if you want to replace it.",
      );
      return;
    }
    const entry: PeriodLog = {
      id: crypto.randomUUID(),
      startDate,
      endDate: endDate || undefined,
      flow,
      pain,
      notes: notes.trim() || undefined,
    };
    if (!persist([...logs, entry])) return;
    setSaved(true);
    setEndDate("");
    setNotes("");
  }

  function remove(id: string) {
    persist(logs.filter((x) => x.id !== id));
  }

  return (
    <section id="tracker" className="panel">
      <div className="sectionHeading">
        <div>
          <span className="eyebrow">My cycle</span>
          <h2>Your cycle at a glance</h2>
        </div>
        <span className="pill">Saved on this device</span>
      </div>
      <div className="cycleOverview">
        <div className="predictionCard">
          <span className="eyebrow">Next period</span>
          <h3>
            {predictedNextPeriod(starts)
              ? "Around " + predictedNextPeriod(starts)
              : "Getting to know your cycle"}
          </h3>
          <p>
            {predictedNextPeriod(starts)
              ? "Estimate only. Your cycle can change."
              : "Save at least two period starts to see an estimate."}
          </p>
          <a className="textlink" href="#period-form">
            Log my period →
          </a>
        </div>
        <CycleCalendar logs={logs} prediction={predictedNextPeriod(starts)} />
      </div>
      <div className="logIntro" id="period-form">
        <span className="eyebrow">Save a period log</span>
        <h2>How are you feeling?</h2>
        <p className="muted">
          A few details now can help you notice changes later.
        </p>
      </div>

      <div className="formgrid">
        <label>
          Period start
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          Period end (optional)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label>
          Typical flow
          <select
            value={flow}
            onChange={(e) => setFlow(e.target.value as Flow)}
          >
            <option>spotting</option>
            <option>light</option>
            <option>medium</option>
            <option>heavy</option>
          </select>
        </label>
        <label>
          Pain: {pain}/10
          <input
            type="range"
            min="0"
            max="10"
            value={pain}
            onChange={(e) => setPain(+e.target.value)}
          />
        </label>
        <label className="span2">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. cramps stronger than usual"
          />
        </label>
      </div>

      {formError && (
        <div role="alert" className="risk attention">
          {formError}
        </div>
      )}
      <div className={"risk " + safety.level}>{safety.message}</div>
      <div className="saveRow">
        <button className="btn" onClick={save}>
          Save log →
        </button>
        <small>Works offline · Stored only in this browser</small>
      </div>
      {saved && (
        <p role="status" className="risk routine">
          Your period log is saved on this device.
        </p>
      )}

      <div className="stats">
        <div>
          <b>{averageCycleLength(starts) ?? "—"}</b>
          <span>average cycle days</span>
        </div>
        <div>
          <b>{predictedNextPeriod(starts) ?? "—"}</b>
          <span>estimated next period</span>
        </div>
        <div>
          <b>{logs.length}</b>
          <span>saved periods</span>
        </div>
      </div>

      {logs.length === 0 && (
        <p className="muted">
          No saved periods yet. Your history will appear here after your first
          log.
        </p>
      )}
      {logs.length > 0 && (
        <div className="history" id="history">
          <h3>My period logs</h3>
          {logs.map((x) => (
            <div className="historyrow" key={x.id}>
              <div>
                <strong>
                  {x.startDate}
                  {x.endDate ? " → " + x.endDate : ""}
                </strong>
                <span>
                  {x.flow} flow · pain {x.pain}/10
                  {x.notes ? " · " + x.notes : ""}
                </span>
              </div>
              <button className="textbtn" onClick={() => remove(x.id)}>
                Remove
              </button>
            </div>
          ))}
          <button
            className="textbtn danger"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete all period logs from this browser? This cannot be undone.",
                )
              )
                return;
              try {
                localStorage.removeItem(KEY);
                localStorage.removeItem(LEGACY_KEY);
                setLogs([]);
                setSaved(false);
              } catch {
                setFormError(
                  "Could not delete local data. Check your browser storage settings.",
                );
              }
            }}
          >
            Delete all local cycle data
          </button>
        </div>
      )}
    </section>
  );
}

function CycleCalendar({
  logs,
  prediction,
}: {
  logs: PeriodLog[];
  prediction: string | null;
}) {
  const now = new Date();
  const year = now.getUTCFullYear(),
    month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const prefix = year + "-" + String(month + 1).padStart(2, "0") + "-";
  const logged = new Set(logs.map((log) => log.startDate));
  const title = new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  return (
    <div aria-label={title + " period calendar"}>
      <div className="calendarTitle">
        <strong>{title}</strong>
        <span className="pill">This month</span>
      </div>
      <div className="calendarGrid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span aria-hidden="true" key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1,
            date = prefix + String(day).padStart(2, "0"),
            isLogged = logged.has(date),
            isPredicted = date === prediction;
          return (
            <span
              key={date}
              className={[
                isLogged ? "logged" : isPredicted ? "predicted" : "",
                day === now.getUTCDate() ? "today" : "",
              ].join(" ")}
              aria-label={
                date +
                (isLogged
                  ? ", logged period start"
                  : isPredicted
                    ? ", estimated next period"
                    : "")
              }
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="calendarLegend">
        Green: logged start · Lemon: estimated start · Outline: today
      </p>
    </div>
  );
}
