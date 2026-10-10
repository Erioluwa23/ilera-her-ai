"use client";
import { useEffect, useRef, useState } from "react";
import { useHealthData } from "@/lib/health-store";
import {
  emptyHealthData,
  validateHealthData,
  mergeHealthData,
  type HealthData,
} from "@/lib/health/records";
import { readLegacy, migrateLegacy } from "@/lib/legacy-data";
import { legacyVoiceCount, recoverLegacyVoice } from "@/lib/voice-chat-store";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import ConfirmationDialog from "./ConfirmationDialog";
import EnglishContent from "./EnglishContent";
export function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DataControls() {
  const store = useHealthData(),
    { language } = useLanguage(),
    [incoming, setIncoming] = useState<HealthData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [mapped, setMapped] = useState(false),
    [legacy, setLegacy] = useState<ReturnType<typeof readLegacy> | null>(null),
    [oldVoice, setOldVoice] = useState(0),
    [ownership, setOwnership] = useState(false),
    [deleting, setDeleting] = useState(false),
    active = useRef(false);
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        setLegacy(readLegacy(localStorage));
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Old records could not be opened.",
        );
      }
    });
    legacyVoiceCount()
      .then(setOldVoice)
      .catch(() =>
        setMessage(
          "Old conversations could not be opened. Original data is preserved.",
        ),
      );
  }, []);
  async function choose(file?: File) {
    setIncoming(null);
    setMapped(false);
    setMessage("");
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error(
          "Choose a structured file under 5 MB. Audio is restored separately.",
        );
      const parsed = validateHealthData(JSON.parse(await file.text()));
      mergeHealthData(store.data, parsed);
      setIncoming(parsed);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "This file is invalid. Current records are unchanged.",
      );
    }
  }
  async function restore() {
    if (!incoming || active.current || (incoming.babies.length > 0 && !mapped))
      return;
    active.current = true;
    setBusy(true);
    if (await store.commit((current) => mergeHealthData(current, incoming))) {
      setIncoming(null);
      setMessage(
        "Selected file records restored on this device. Identical IDs were not duplicated.",
      );
    }
    active.current = false;
    setBusy(false);
  }
  return (
    <EnglishContent>
      <section className="dataControls">
        <h2>Data on this device</h2>
        <p>
          Files can contain private health information. Import does not create a
          cloud backup.
        </p>
        <label>
          {copy(language, "restore")}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        {incoming && (
          <div className="selectedDay">
            <h3>Review this import</h3>
            <p>Target: the account currently signed in, on this device.</p>
            {incoming.babies.map((child) => (
              <p key={child.id}>
                Child profile: {child.name || "Unnamed child"} · born{" "}
                {child.birthDate} · ID {child.id}
              </p>
            ))}
            <ul>
              {Object.entries(incoming)
                .filter(([k]) => !["version", "revision"].includes(k))
                .map(([k, v]) => (
                  <li key={k}>
                    {k}: {(v as unknown[]).length}
                  </li>
                ))}
            </ul>
            {incoming.babies.length > 0 && (
              <label className="checkChoice">
                <input
                  type="checkbox"
                  checked={mapped}
                  onChange={(e) => setMapped(e.target.checked)}
                />
                Keep the child profiles in this file with their original IDs.
                Measurements remain linked to those profiles, not the last
                selected child.
              </label>
            )}
            <button
              className="btn"
              disabled={busy || (incoming.babies.length > 0 && !mapped)}
              onClick={restore}
            >
              Confirm import
            </button>
            <button className="textbtn" onClick={() => setIncoming(null)}>
              Cancel
            </button>
          </div>
        )}
        {legacy?.records.length || oldVoice > 0 ? (
          <div className="selectedDay">
            <h3>Recover earlier browser data</h3>
            <p>
              Found {legacy?.records.length || 0} period records and {oldVoice}{" "}
              old messages without account ownership. Their contents are hidden
              and the original stores remain intact.
            </p>
            <label className="checkChoice">
              <input
                type="checkbox"
                checked={ownership}
                onChange={(e) => setOwnership(e.target.checked)}
              />
              I confirm these old records are mine and choose to copy them into
              this account. If this is a shared device and ownership is
              uncertain, I will leave them in place.
            </label>
            <button
              className="secondaryBtn"
              disabled={!ownership || busy}
              onClick={async () => {
                if (!store.owner) return;
                setBusy(true);
                const success =
                  !legacy?.records.length ||
                  (await store.commit((current) =>
                    migrateLegacy(current, legacy.records),
                  ));
                if (success) {
                  try {
                    await recoverLegacyVoice(store.owner);
                    setMessage(
                      "Recovery completed. IDs, notes, conversation ancestry and retained audio were copied; the original stores are unchanged.",
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error
                        ? e.message
                        : "Conversation recovery failed.",
                    );
                  }
                }
                setBusy(false);
              }}
            >
              Copy my old records
            </button>
            {legacy?.raw && (
              <button
                className="textbtn"
                disabled={!ownership}
                onClick={() =>
                  downloadFile(
                    "ileraher-original-browser-data.json",
                    legacy.raw!,
                  )
                }
              >
                Download original period store
              </button>
            )}
          </div>
        ) : null}
        <p>
          <a href="/history">Choose and export records from History</a>
        </p>
        <button className="textbtn danger" onClick={() => setDeleting(true)}>
          Delete all local health records for this account
        </button>
        {message && (
          <p role="status" className="statusBox">
            {message}
          </p>
        )}
        {store.error && <p role="alert">{store.error}</p>}
        {deleting && (
          <ConfirmationDialog
            title="Delete all structured health records?"
            confirmLabel="Delete health records"
            busy={busy}
            onClose={() => setDeleting(false)}
            onConfirm={async () => {
              setBusy(true);
              if (await store.commit(() => emptyHealthData())) {
                setDeleting(false);
                setMessage(
                  "Structured health records deleted from this account on this device.",
                );
              }
              setBusy(false);
            }}
          >
            <p>
              This permanently removes periods, pregnancy records, child
              profiles, measurements, tests, conception records and saved
              appointments from this account on this device. Your account and
              saved conversations are separate. Original unscoped data is
              preserved.
            </p>
          </ConfirmationDialog>
        )}
      </section>
    </EnglishContent>
  );
}
