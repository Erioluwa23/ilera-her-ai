"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useUI } from "@/lib/ui-language";
import Icon from "./Icon";

type Account = { phone: string; enrolled: boolean; keepReplies: boolean; replies: { id: string; createdAt: string; question: string; answer: string; model: string; urgency: string }[] };
export default function PhoneSettings() {
  const { t, locale, language } = useUI();
  const [account, setAccount] = useState<Account | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [pin, setPin] = useState(""), [confirm, setConfirm] = useState(""), [password, setPassword] = useState("");
  const [keep, setKeep] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/phone/account", { cache: "no-store" });
    if (!response.ok) throw new Error("Account unavailable");
    const data: Account = await response.json(); setAccount(data); setKeep(data.keepReplies);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/phone/account", { cache: "no-store" }), fetch("/api/phone/status", { cache: "no-store" })])
      .then(async ([a, s]) => {
        const data = a.ok ? await a.json() as Account : null, status = s.ok ? await s.json() : null;
        if (cancelled) return;
        if (data) { setAccount(data); setKeep(data.keepReplies); }
        else setMessage(t("phoneAccountError"));
        setNumber(status?.ready ? status.phoneNumber : null);
      }).catch(() => { if (!cancelled) setMessage(t("phoneAccountError")); });
    return () => { cancelled = true; };
  }, [language]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pin !== confirm) { setMessage(t("phonePinMismatch")); return; }
    await update(false);
  }
  async function update(remove: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/phone/account", { method: remove ? "DELETE" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin, password, keepReplies: keep }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || t("phoneAccountError")); return; }
      setPassword(""); setPin(""); setConfirm("");
      await load(); setMessage(t(remove ? "phoneRemoved" : "phoneSaved"));
    } catch { setMessage(t("phoneAccountError")); } finally { setBusy(false); }
  }
  return (
    <section className="ux-help">
      <div className="ux-page-heading"><h1><Icon name="phone" /> {t("phone")}</h1></div>
      <p>{number ? t("phoneCallHint") : t("phonePilotPending")}</p>
      {number && <a className="ux-btn" href={"tel:" + number}><Icon name="phone" /> {number}</a>}
      {account && <>
        <p className="ux-muted">{t("phoneRegistered")}: {account.phone}</p>
        <form className="authForm" onSubmit={save}>
          <label>{t("phoneCallingPin")}<input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} value={pin} onChange={e => setPin(e.target.value)} required /></label>
          <label>{t("phoneConfirmPin")}<input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
          <label>{t("password")}<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <label className="ux-phone-checkbox"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />{t("phoneSaveReplies")}</label>
          <p className="ux-muted">{t("phonePrivacyHint")}</p>
          <button className="ux-btn" type="submit" disabled={busy}>{busy ? t("loading") : t("phoneSavePin")}</button>
          {account.enrolled && <button className="ux-btn ux-secondary" type="button" disabled={busy || !password} onClick={() => void update(true)}>{t("phoneRemove")}</button>}
        </form>
        <p className="ux-muted">{t("phonePinChangeHint")}</p>
        <div className="ux-page-heading"><h2>{t("phoneReplies")}</h2></div>
        {account.replies.length === 0 ? <p className="ux-muted">{t("phoneNoReplies")}</p> : account.replies.map(reply => <article className="ux-phone-card" key={reply.id}>
          <small>{new Date(reply.createdAt).toLocaleString(locale)} · {reply.model === "curated" ? t("phoneReviewed") : "N-ATLAS"}</small>
          <p><strong>{reply.question}</strong></p><p>{reply.answer}</p>
        </article>)}
      </>}
      {message && <p role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
