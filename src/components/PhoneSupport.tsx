"use client";
import { useEffect, useState } from "react";
import { languageName, type IlaraLanguage } from "@/lib/languages";
type Status = {
  ready: boolean;
  phoneNumber: string | null;
  languages: IlaraLanguage[];
};
export default function PhoneSupport() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ivr/status", { signal: controller.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStatus)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <article className="selectedDay">
      <span className="pill">
        {status?.ready
          ? "Phone calls · Available"
          : "Phone calls · Setup in progress"}
      </span>
      <h2>Call from an ordinary phone</h2>
      <ol className="ivrSteps">
        <li>Choose your language using the keypad</li>
        <li>Agree to recording, then speak after the beep</li>
        <li>Listen to guidance; replay or ask another question</li>
      </ol>
      {status?.ready && status.phoneNumber ? (
        <>
          <a className="btn" href={"tel:" + status.phoneNumber}>
            Call {status.phoneNumber}
          </a>
          <p className="muted">
            Languages: {status.languages.map(languageName).join(", ")}
          </p>
        </>
      ) : (
        <p className="muted" role="status">
          {error
            ? "Could not check phone availability. Please try later."
            : "The call service is being connected. A verified support number will appear here when it is ready."}
        </p>
      )}
      <p className="small muted">
        No mobile data needed for a phone call. Network and international call
        charges may apply. This service does not provide emergency care.
      </p>
    </article>
  );
}
