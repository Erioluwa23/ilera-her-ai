"use client";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { safeReturn } from "@/lib/return-route";
import { scopedKey } from "@/lib/experience";
import LanguagePicker from "./LanguagePicker";
import EnglishContent from "./EnglishContent";
export default function AuthForm({
  mode,
  next = "/",
}: {
  mode: "login" | "signup";
  next?: string;
}) {
  const router = useRouter(),
    { language } = useLanguage(),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [visible, setVisible] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null),
    signup = mode === "signup",
    target = safeReturn(next);
  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    setError("");
    if (signup && password !== confirm) {
      fail("Passwords do not match.");
      return;
    }
    active.current = true;
    setBusy(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        fail(
          r.status === 401
            ? "Incorrect phone number or password."
            : "Sign in is temporarily unavailable. Try again.",
        );
        return;
      }
      let setup = false;
      try {
        setup =
          JSON.parse(
            localStorage.getItem(
              scopedKey(String(data.user.id), "preferences-v1"),
            ) || "{}",
          ).onboardingVersionCompleted >= 1;
      } catch {
        /* Onboarding explains storage recovery. */
      }
      router.replace(
        setup
          ? target === "/"
            ? "/home"
            : target
          : "/onboarding?next=" +
              encodeURIComponent(target === "/" ? "/home" : target),
      );
      router.refresh();
    } catch {
      fail("Could not connect. Check your internet connection and try again.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="authPage">
      <section className="authCard">
        <Link className="brand authBrand" href="/login">
          ÌleraHer <span>AI</span>
        </Link>
        <LanguagePicker />
        <p>{copy(language, "purpose")}</p>
        <h1>{copy(language, signup ? "signUp" : "signIn")}</h1>
        <form className="authForm" onSubmit={submit}>
          <label>
            {copy(language, "phone")}
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label>
            {copy(language, "password")}
            <input
              type={visible ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-describedby="password-hint"
            />
          </label>
          <EnglishContent>
            <small id="password-hint">
              Use 8–128 characters. Password managers and paste are supported.
            </small>
          </EnglishContent>
          <button
            className="textbtn"
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {copy(language, visible ? "hidePassword" : "showPassword")}
          </button>
          {signup && (
            <label>
              {copy(language, "confirmPassword")}
              <input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
          )}
          {error && (
            <p className="authError" ref={errorRef} tabIndex={-1} role="alert">
              {error}
            </p>
          )}
          <button className="btn fullWidth" disabled={busy}>
            {busy ? "…" : copy(language, signup ? "signUp" : "signIn")}
          </button>
        </form>
        <div className="screenActions">
          <Link
            className="textlink"
            href={
              (signup ? "/login" : "/signup") +
              "?next=" +
              encodeURIComponent(target)
            }
          >
            {copy(language, signup ? "signIn" : "signUp")}
          </Link>
          <Link className="textlink" href="/help">
            {copy(language, "help")}
          </Link>
        </div>
        <EnglishContent>
          <p className="small">
            Health records stay on this device. Signing in is not cloud backup.
            People using the same unlocked browser may be able to access local
            data.
          </p>
        </EnglishContent>
      </section>
    </main>
  );
}
