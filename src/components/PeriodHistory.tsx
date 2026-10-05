"use client";
import Link from "next/link";
import { usePeriodLogs } from "@/lib/period-store";
export default function PeriodHistory() {
  const { logs, error, persist, clear } = usePeriodLogs();
  return (
    <section className="panel historyScreen">
      <span className="eyebrow">Your records</span>
      <h1>My period logs</h1>
      <p className="muted">
        Your notes help you notice changes. Records stay in this browser.
      </p>
      {!logs.length ? (
        <div className="selectedDay">
          <h2>No logs yet</h2>
          <p className="muted">Save your first period to start your history.</p>
        </div>
      ) : (
        logs.map((x) => (
          <article className="historyrow" key={x.id}>
            <div>
              <Link className="textlink" href={"/log?date=" + x.startDate}>
                {x.startDate}
                {x.endDate ? " → " + x.endDate : ""}
              </Link>
              <span>
                {x.flow} flow · Pain {x.pain}/10
                {x.symptoms?.length ? " · " + x.symptoms.join(", ") : ""}
                {x.notes ? " · " + x.notes : ""}
              </span>
            </div>
            <button
              className="textbtn danger"
              aria-label={"Remove period starting " + x.startDate}
              onClick={() => {
                if (window.confirm("Remove this period log?"))
                  persist(logs.filter((log) => log.id !== x.id));
              }}
            >
              Remove
            </button>
          </article>
        ))
      )}
      {error && (
        <p role="alert" className="risk attention">
          {error}
        </p>
      )}
      <div className="screenActions">
        <Link className="btn" href="/log">
          Log a period →
        </Link>
        <Link className="secondaryBtn" href="/cycle">
          View calendar
        </Link>
      </div>
      {logs.length > 0 && (
        <button
          className="textbtn danger"
          onClick={() => {
            if (
              window.confirm(
                "Delete every period log from this browser? This cannot be undone.",
              )
            )
              clear();
          }}
        >
          Delete all local records
        </button>
      )}
    </section>
  );
}
