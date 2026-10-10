"use client";
import { useEffect, useState } from "react";
import { languageName, type IlaraLanguage } from "@/lib/languages";
import EnglishContent from "./EnglishContent";
type Status = {
  ready: boolean;
  phoneNumber: string | null;
  languages: IlaraLanguage[];
  historyLanguages?: IlaraLanguage[];
};
export default function PhoneSupport() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/ivr/status", { signal: c.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((x) => {
        if (typeof x.ready !== "boolean" || !Array.isArray(x.languages))
          throw new Error();
        setStatus(x);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [attempt]);
  const ready =
    status?.ready &&
    !!status.phoneNumber &&
    /^\+[1-9]\d{7,14}$/.test(status.phoneNumber);
  return (
    <EnglishContent>
      <article className="selectedDay">
        <span className="pill">
          Phone support ·{" "}
          {error
            ? "Could not check"
            : !status
              ? "Checking availability"
              : ready
                ? "Ready"
                : "Not available yet"}
        </span>
        <h2>Call from an ordinary phone</h2>
        <ol>
          <li>Choose your language using the keypad.</li>
          <li>Agree to recording, then speak after the beep.</li>
          <li>Listen to guidance; replay or ask a follow-up.</li>
        </ol>
        {ready ? (
          <>
            <a className="btn" href={"tel:" + status!.phoneNumber}>
              Call {status!.phoneNumber}
            </a>
            <p>Languages: {status!.languages.map(languageName).join(", ")}</p>
          </>
        ) : (
          <p role="status">
            {error
              ? "Could not check phone availability."
              : status
                ? "A verified support number will appear when the service is ready."
                : "Checking availability…"}
          </p>
        )}
        {error && (
          <button
            className="secondaryBtn"
            onClick={() => {
              setError(false);
              setStatus(null);
              setAttempt(attempt + 1);
            }}
          >
            Try again
          </button>
        )}
        {!!status?.historyLanguages?.length && (
          <p>
            Optional phone history uses your number and a six-digit PIN for up
            to 30 days. Press 5 after a reply to delete it. Phone and web
            histories are separate.
          </p>
        )}
        <p className="small muted">
          Network and international call charges may apply. Phone support is not
          an emergency service. Source readiness is not evidence of a tested
          live call.
        </p>
      </article>
    </EnglishContent>
  );
}
