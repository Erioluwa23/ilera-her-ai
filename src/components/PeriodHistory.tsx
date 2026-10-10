"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useHealthData } from "@/lib/health-store";
import { emptyHealthData, type HealthData } from "@/lib/health/records";
import {
  loadVoiceMessages,
  deleteVoiceConversation,
} from "@/lib/voice-chat-store";
import type { VoiceMessage } from "@/lib/voice-chat";
import { usePreferences } from "@/lib/experience";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { displayDate, todayIn } from "@/lib/health/date-only";
import ConfirmationDialog from "./ConfirmationDialog";
import EnglishContent from "./EnglishContent";
import { downloadFile } from "./DataControls";
type Kind =
  | "periods"
  | "pregnancies"
  | "babies"
  | "measurements"
  | "conception"
  | "tests"
  | "appointments"
  | "conversations";
type Row = {
  id: string;
  key: string;
  kind: Kind;
  date: string;
  label: string;
  route: string;
};
export default function PeriodHistory() {
  const store = useHealthData(),
    { prefs } = usePreferences(),
    { language } = useLanguage(),
    [voices, setVoices] = useState<VoiceMessage[]>([]),
    [voiceError, setVoiceError] = useState(""),
    [filter, setFilter] = useState<Kind | "all">("all"),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState(false),
    [pending, setPending] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (store.owner)
        loadVoiceMessages(store.owner)
          .then((x) => {
            if (!cancelled) {
              setVoices(x);
              setVoiceError("");
            }
          })
          .catch(() => {
            if (!cancelled)
              setVoiceError(
                "Saved conversations could not be opened. Try again from Ask.",
              );
          });
    };
    load();
    window.addEventListener("ileraher-voice-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("ileraher-voice-changed", load);
    };
  }, [store.owner]);
  const rows: Row[] = [
    ...store.data.periods.map((x) => ({
      id: x.id,
      key: "periods:" + x.id,
      kind: "periods" as const,
      date: x.startDate,
      label: copy(language, "periods"),
      route: "/log?id=" + x.id,
    })),
    ...store.data.pregnancies.map((x) => ({
      id: x.id,
      key: "pregnancies:" + x.id,
      kind: "pregnancies" as const,
      date: x.updatedAt.slice(0, 10),
      label: copy(language, "pregnancy") + " · " + x.status,
      route: "/pregnancy?id=" + x.id,
    })),
    ...store.data.babies.map((x) => ({
      id: x.id,
      key: "babies:" + x.id,
      kind: "babies" as const,
      date: x.birthDate,
      label: x.name || copy(language, "baby"),
      route: "/baby?id=" + x.id,
    })),
    ...store.data.measurements.map((x) => ({
      id: x.id,
      key: "measurements:" + x.id,
      kind: "measurements" as const,
      date: x.date,
      label:
        (store.data.babies.find((b) => b.id === x.babyId)?.name || "Child") +
        " · " +
        x.value +
        " " +
        x.unit,
      route: "/growth?id=" + x.id,
    })),
    ...store.data.conception.map((x) => ({
      id: x.id,
      key: "conception:" + x.id,
      kind: "conception" as const,
      date: x.startDate,
      label: copy(language, "conception"),
      route: "/conception?id=" + x.id,
    })),
    ...store.data.tests.map((x) => ({
      id: x.id,
      key: "tests:" + x.id,
      kind: "tests" as const,
      date: x.date,
      label: "Test · " + x.result,
      route: "/late-period?id=" + x.id,
    })),
    ...store.data.appointments.map((x) => ({
      id: x.id,
      key: "appointments:" + x.id,
      kind: "appointments" as const,
      date: x.date,
      label: "Appointment · " + x.time,
      route: x.pregnancyId
        ? "/pregnancy?id=" + x.pregnancyId
        : "/baby?id=" + x.babyId,
    })),
    ...[...new Set(voices.map((x) => x.conversationId))].map((id) => ({
      id,
      key: "conversations:" + id,
      kind: "conversations" as const,
      date: todayIn(
        "Africa/Lagos",
        new Date(voices.find((x) => x.conversationId === id)!.createdAt),
      ),
      label:
        copy(language, "conversations") +
        " · " +
        voices.filter((x) => x.conversationId === id).length,
      route: "/voice?thread=" + id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = rows.filter(
    (x) =>
      (filter === "all" || x.kind === filter) &&
      (!from || x.date >= from) &&
      (!until || x.date <= until),
  );
  const chosen = rows.filter((x) => selected.includes(x.key)),
    data = emptyHealthData();
  for (const key of [
    "periods",
    "pregnancies",
    "babies",
    "measurements",
    "appointments",
    "conception",
    "tests",
  ] as const)
    (data[key] as { id: string }[]) = store.data[key].filter((x) =>
      selected.includes(key + ":" + x.id),
    );
  // Include required parents in the visible preview so a measurement can be restored safely.
  const childIds = [
    ...data.measurements.map((x) => x.babyId),
    ...data.appointments.map((x) => x.babyId).filter(Boolean),
  ];
  const pregnancyIds = data.appointments
    .map((x) => x.pregnancyId)
    .filter(Boolean);
  data.babies = store.data.babies.filter(
    (x) => data.babies.some((b) => b.id === x.id) || childIds.includes(x.id),
  );
  data.pregnancies = store.data.pregnancies.filter(
    (x) =>
      data.pregnancies.some((p) => p.id === x.id) ||
      pregnancyIds.includes(x.id),
  );
  async function remove() {
    if (!pending || busy) return;
    setBusy(true);
    let success = false;
    if (pending.kind === "conversations") {
      try {
        await deleteVoiceConversation(store.owner!, pending.id);
        setVoices(voices.filter((x) => x.conversationId !== pending.id));
        success = true;
      } catch {
        setNotice("This conversation was not deleted. Try again.");
      }
    } else
      success = await store.commit((current) => {
        const next: HealthData = { ...current };
        if (pending.kind === "conversations") return next;
        (next[pending.kind] as { id: string }[]) = next[pending.kind].filter(
          (x) => x.id !== pending.id,
        );
        if (pending.kind === "babies") {
          next.measurements = next.measurements.filter(
            (x) => x.babyId !== pending.id,
          );
          next.appointments = next.appointments.filter(
            (x) => x.babyId !== pending.id,
          );
        }
        if (pending.kind === "pregnancies")
          next.appointments = next.appointments.filter(
            (x) => x.pregnancyId !== pending.id,
          );
        return next;
      });
    if (success) {
      setPending(null);
      setSelected(selected.filter((x) => x !== pending.key));
      setNotice("Record deleted from this device.");
    }
    setBusy(false);
  }
  return (
    <section className="panel historyScreen">
      <span className="eyebrow">{copy(language, "onDevice")}</span>
      <h1>{copy(language, "history")}</h1>
      <div className="historyFilters">
        <label>
          {copy(language, "list")}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(0);
            }}
          >
            <option value="all">{copy(language, "all")}</option>
            {(
              [
                "periods",
                "conversations",
                "pregnancies",
                "babies",
                "measurements",
                "conception",
                "tests",
                "appointments",
              ] as Kind[]
            ).map((x) => (
              <option key={x} value={x}>
                {x === "periods"
                  ? copy(language, "periods")
                  : x === "conversations"
                    ? copy(language, "conversations")
                    : x}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Until
          <input
            type="date"
            value={until}
            onChange={(e) => {
              setUntil(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {!store.loaded ? (
        <p role="status">{copy(language, "loading")}</p>
      ) : store.error ? (
        <p role="alert" className="risk urgent">
          {store.error}
        </p>
      ) : !filtered.length ? (
        <div className="selectedDay">
          <h2>{copy(language, "noRecords")}</h2>
          <EnglishContent>
            <p>
              {filter === "conversations" &&
              prefs.conversationRetention === "session"
                ? "New conversations stay in this session. Existing retained conversations appear here."
                : "There are no saved items matching these filters."}
            </p>
          </EnglishContent>
          <button
            className="textbtn"
            onClick={() => {
              setFilter("all");
              setFrom("");
              setUntil("");
            }}
          >
            Reset filters
          </button>
          <Link className="btn" href="/log">
            {copy(language, "logPeriod")}
          </Link>
        </div>
      ) : (
        filtered.slice(page * 20, page * 20 + 20).map((x) => (
          <article className="historyrow" key={x.key}>
            <label className="checkChoice">
              <input
                type="checkbox"
                checked={selected.includes(x.key)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, x.key]
                      : selected.filter((k) => k !== x.key),
                  )
                }
                aria-label={
                  copy(language, "selected") + " · " + x.label + " · " + x.date
                }
              />
            </label>
            <div>
              <Link className="textlink" href={x.route}>
                {x.label}
              </Link>
              <p>
                {displayDate(x.date, language)} · {copy(language, "onDevice")}
              </p>
            </div>
            <button className="textbtn danger" onClick={() => setPending(x)}>
              {copy(language, "delete")}
            </button>
          </article>
        ))
      )}
      {voiceError && <p role="alert">{voiceError}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="screenActions">
        {page > 0 && (
          <button className="secondaryBtn" onClick={() => setPage(page - 1)}>
            {copy(language, "back")}
          </button>
        )}
        {(page + 1) * 20 < filtered.length && (
          <button className="secondaryBtn" onClick={() => setPage(page + 1)}>
            {copy(language, "continue")}
          </button>
        )}
        <button
          className="secondaryBtn"
          disabled={!chosen.length}
          onClick={() => setPreview(!preview)}
        >
          {copy(language, "export")} ({chosen.length})
        </button>
      </div>
      {preview && (
        <EnglishContent>
          <div className="selectedDay">
            <h2>Review export</h2>
            <p>
              This private file contains only your selection and the parent
              profiles listed below. Health JSON can be restored from Settings.
              Conversation text is a separate download; audio is exported from
              each message in Ask.
            </p>
            <ul>
              {Object.entries(data)
                .filter(([, v]) => Array.isArray(v) && v.length)
                .map(([k, v]) => (
                  <li key={k}>
                    {k}: {(v as unknown[]).length}
                  </li>
                ))}
              {chosen
                .filter((x) => x.kind === "conversations")
                .map((x) => (
                  <li key={x.key}>
                    Conversation: {x.date} · all messages in this selected
                    thread
                  </li>
                ))}
            </ul>
            <button
              className="btn"
              onClick={() => {
                if (
                  Object.values(data).some((v) => Array.isArray(v) && v.length)
                )
                  downloadFile(
                    "ileraher-selected-health-v3.json",
                    JSON.stringify(data, null, 2),
                  );
                const threads = chosen
                  .filter((x) => x.kind === "conversations")
                  .map((x) => x.id);
                if (threads.length)
                  downloadFile(
                    "ileraher-selected-conversation-text.json",
                    JSON.stringify(
                      {
                        version: "conversation-text-v1",
                        messages: voices
                          .filter((x) => threads.includes(x.conversationId))
                          .map((row) => {
                            const text = { ...row };
                            delete text.audio;
                            return text;
                          }),
                      },
                      null,
                      2,
                    ),
                  );
                setNotice(
                  "Download initiated. No recipient has been contacted.",
                );
              }}
            >
              Confirm download
            </button>
          </div>
        </EnglishContent>
      )}
      {pending && (
        <ConfirmationDialog
          title={copy(language, "delete") + " · " + pending.label}
          confirmLabel={copy(language, "delete")}
          busy={busy}
          onClose={() => setPending(null)}
          onConfirm={remove}
        >
          <EnglishContent>
            <p>
              Delete this item from this account on this device?{" "}
              {pending.kind === "conversations"
                ? "All recordings, replies and follow-ups in this conversation will be removed."
                : pending.kind === "babies"
                  ? "All measurements and appointments for this child will also be removed."
                  : pending.kind === "pregnancies"
                    ? "Appointments for this pregnancy will also be removed."
                    : "This deletion is permanent."}
            </p>
          </EnglishContent>
        </ConfirmationDialog>
      )}
    </section>
  );
}
