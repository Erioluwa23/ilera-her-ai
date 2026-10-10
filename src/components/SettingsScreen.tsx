"use client";
import Link from "next/link";
import { useState } from "react";
import { usePreferences, type Preferences } from "@/lib/experience";
import { useLanguage } from "@/lib/use-language";
import { copy, type CopyKey } from "@/lib/ui-copy";
import LanguagePicker from "./LanguagePicker";
import LogoutButton from "./LogoutButton";
import AdminNavLink from "./AdminNavLink";
import DataControls from "./DataControls";
import EnglishContent from "./EnglishContent";
export default function SettingsScreen() {
  const { prefs, update, error } = usePreferences(),
    { language } = useLanguage(),
    [status, setStatus] = useState("");
  function change(next: Partial<Preferences>) {
    setStatus(
      update(next)
        ? copy(language, "saveChanges") + " ✓"
        : copy(language, "notSaved"),
    );
  }
  const toggles: {
    field:
      | "sharedDevice"
      | "hideSensitivePreviews"
      | "lowData"
      | "keepAudio"
      | "externalAI";
    label: CopyKey;
  }[] = [
    { field: "sharedDevice", label: "sharedDevice" },
    { field: "hideSensitivePreviews", label: "hidePreviews" },
    { field: "lowData", label: "lowData" },
    { field: "keepAudio", label: "keepAudio" },
    { field: "externalAI", label: "externalAI" },
  ];
  return (
    <section className="panel taskPanel">
      <h1>{copy(language, "settings")}</h1>
      <LanguagePicker />
      <h2>{copy(language, "privacy")}</h2>
      {toggles.map((x) => (
        <label className="checkChoice" key={x.field}>
          <input
            type="checkbox"
            checked={prefs[x.field]}
            disabled={
              x.field === "keepAudio" &&
              (prefs.sharedDevice || prefs.conversationRetention === "session")
            }
            onChange={(e) =>
              change({
                [x.field]: e.target.checked,
                ...(x.field === "sharedDevice" && e.target.checked
                  ? { conversationRetention: "session", keepAudio: false }
                  : {}),
              })
            }
          />
          {copy(language, x.label)}
        </label>
      ))}
      <label className="checkChoice">
        <input
          type="checkbox"
          disabled={prefs.sharedDevice}
          checked={
            prefs.conversationRetention === "device" && !prefs.sharedDevice
          }
          onChange={(e) =>
            change({
              conversationRetention: e.target.checked ? "device" : "session",
              ...(!e.target.checked ? { keepAudio: false } : {}),
            })
          }
        />
        {copy(language, "keepConversations")}
      </label>
      <EnglishContent>
        <p>
          Keeping recordings is optional and separate from keeping text.
          Existing saved recordings stay intact when you change preferences.
        </p>
        <p>
          External AI explanations send necessary confirmed information to
          configured Groq/OpenAI services. You can use local records and basic
          guidance with this option off. New voice transcription sends audio to
          the existing N-ATLAS speech service after its separate notice.
        </p>
        <p>
          Shared-device mode hides previews and keeps new conversations and
          drafts in memory. Explicitly saved health records still remain on the
          device. Browser storage is not an encrypted vault.
        </p>
        <p>
          Research and cloud synchronization are not enabled. Review retention
          and international processing before production health traffic.
        </p>
      </EnglishContent>
      {status && (
        <p className="statusBox" role="status">
          {status}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="screenActions">
        <Link className="secondaryBtn" href="/lite">
          {copy(language, "lowData")}
        </Link>
        <Link className="textlink" href="/home">
          {copy(language, "home")}
        </Link>
      </div>
      <DataControls />
      <h2>Account</h2>
      <EnglishContent>
        <p>
          Signing out stops recording and playback. It does not erase saved
          local files or health records.
        </p>
      </EnglishContent>
      <LogoutButton />
      <AdminNavLink />
      <p>
        <Link href="/feedback">{copy(language, "feedback")}</Link> ·{" "}
        <Link href="/help">{copy(language, "help")}</Link>
      </p>
    </section>
  );
}
