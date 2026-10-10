"use client";
import { useState } from "react";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { clearVoiceSessions } from "@/lib/voice-session";
export default function LogoutButton() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    { language } = useLanguage();
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw new Error();
      clearVoiceSessions();
      window.dispatchEvent(new Event("ileraher-session-ended"));
      window.speechSynthesis?.cancel();
      location.replace("/login");
    } catch {
      setError(
        "Sign out did not complete. You are still signed in. Try again.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <button className="secondaryBtn" onClick={logout} disabled={busy}>
        {copy(language, "signOut")}
        {busy ? "…" : ""}
      </button>
      {error && (
        <p role="alert" className="risk urgent">
          {error}
        </p>
      )}
    </>
  );
}
