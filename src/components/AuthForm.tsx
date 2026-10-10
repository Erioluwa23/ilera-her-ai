"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Flower } from "./Icon";
import { useUI } from "@/lib/ui-language";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "@/lib/languages";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { t, language, setLanguage } = useUI();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (signup && password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("offlineHint"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard" aria-labelledby="auth-title">
        <Link className="brand authBrand" href={signup ? "/signup" : "/login"}>
          <Flower size={40} /> ÌleraHer
        </Link>
        <span className="eyebrow">
          {signup ? t("createAccount") : t("welcomeBack")}
        </span>
        <h1 id="auth-title">{signup ? t("createAccount") : t("signIn")}</h1>
        <p className="muted">{signup ? t("createHint") : t("signInHint")}</p>

        <label className="ux-auth-language">
          {t("language")}
          <select
            value={language}
            aria-label={t("chooseLanguage")}
            onChange={(e) => setLanguage(e.target.value as IlaraLanguage)}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <form className="authForm" onSubmit={submit}>
          <label>
            {t("phoneNumber")}
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0801 234 5678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>
          <label>
            {t("password")}
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {signup && (
            <label>
              {t("confirmPassword")}
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
          )}
          {error && (
            <p className="authError" role="alert">
              {error}
            </p>
          )}
          <button className="btn fullWidth" disabled={busy} type="submit">
            {busy ? t("loading") : signup ? t("createAccount") : t("signIn")}
          </button>
        </form>

        <p className="authSwitch">
          {signup ? t("alreadyAccount") : t("newHere")}{" "}
          <Link href={signup ? "/login" : "/signup"}>
            {signup ? t("signIn") : t("createAccount")}
          </Link>
        </p>
        <small className="muted">{t("healthInfo")}</small>
      </section>
    </main>
  );
}
