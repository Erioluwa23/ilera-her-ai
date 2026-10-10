"use client";
import { useState } from "react";
import Link from "next/link";
import { useUI } from "@/lib/ui-language";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { usePeriodLogs } from "@/lib/period-store";
import {
  loadVoiceMessages,
  deleteVoiceConversation,
} from "@/lib/voice-chat-store";
import { downloadJson } from "@/lib/ui-utils";
import Icon from "./Icon";
import Dialog from "./Dialog";
import LogoutButton from "./LogoutButton";
import AdminNavLink from "./AdminNavLink";
export default function PrivacyPanel() {
  const { t, language, setLanguage } = useUI(),
    store = usePeriodLogs();
  const [action, setAction] = useState<"export" | "logs" | "chats">(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      if (action === "export")
        downloadJson(
          {
            schema: "ileraher-periods-v2",
            exportedAt: new Date().toISOString(),
            periods: store.logs,
          },
          "ileraher-period-records.json",
        );
      if (action === "logs" && !store.clear()) throw new Error(t("saveError"));
      if (action === "chats") {
        const messages = await loadVoiceMessages();
        for (const id of new Set(messages.map((m) => m.conversationId)))
          await deleteVoiceConversation(id);
        localStorage.removeItem("ileraher-active-conversation-v1");
        localStorage.removeItem("ileraher-conversation-names-v1");
        for (const key of Object.keys(localStorage))
          if (key.startsWith("ileraher-text-draft-v1:"))
            localStorage.removeItem(key);
      }
      setAction(undefined);
      setNotice(t("saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ux-settings">
      <div className="ux-page-heading">
        <p className="ux-eyebrow">{t("space")}</p>
        <h1>{t("privacyLanguage")}</h1>
      </div>
      <section>
        <h2>{t("language")}</h2>
        <div className="ux-language-choices">
          {LANGUAGE_OPTIONS.map((l) => (
            <button
              key={l.code}
              aria-pressed={language === l.code}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>
          <Icon name="lock" /> {t("privacy")}
        </h2>
        <p>{t("privacyDetails")}</p>
        <p>{t("localDisclosure")}</p>
        <p>{t("processingDisclosure")}</p>
        <p className="ux-muted">{t("accountStorage")}</p>
        <div className="ux-actions">
          <Link className="ux-secondary" href="/voice?history=1">
            <Icon name="logs" />
            {t("manageChats")}
          </Link>
          <button className="ux-secondary" onClick={() => setAction("export")}>
            <Icon name="download" />
            {t("export")}
          </button>
        </div>
      </section>
      <section>
        <h2>{t("logs")}</h2>
        <p className="ux-muted">{t("savedBrowser")}</p>
        <div className="ux-actions">
          <button
            className="ux-secondary ux-danger-text"
            onClick={() => setAction("logs")}
          >
            {t("deleteLogs")}
          </button>
          <button
            className="ux-secondary ux-danger-text"
            onClick={() => setAction("chats")}
          >
            {t("deleteChats")}
          </button>
        </div>
      </section>
      <section>
        <AdminNavLink />
        <LogoutButton />
      </section>
      {notice && (
        <p role="status" className="ux-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="ux-alert">
          {error}
        </p>
      )}
      {action && (
        <Dialog
          title={
            action === "export"
              ? t("export")
              : action === "logs"
                ? t("deleteLogs")
                : t("deleteChats")
          }
          onClose={() => setAction(undefined)}
          busy={busy}
        >
          <p>{action === "export" ? t("exportWarning") : t("deleteConfirm")}</p>
          {action === "export" && (
            <p>
              {t("periodDates")} · {store.logs.length}
            </p>
          )}
          <div className="ux-actions">
            <button
              className={action === "export" ? "ux-button" : "ux-danger"}
              disabled={busy}
              onClick={confirm}
            >
              {busy
                ? t("loading")
                : action === "export"
                  ? t("export")
                  : t("delete")}
            </button>
            <button
              className="ux-secondary"
              disabled={busy}
              onClick={() => setAction(undefined)}
            >
              {t("cancel")}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </div>
  );
}
