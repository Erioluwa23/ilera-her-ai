"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
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
      setError("Passwords do not match.");
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
      setError("Could not connect. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard" aria-labelledby="auth-title">
        <Link className="brand authBrand" href={signup ? "/signup" : "/login"}>
          ÌleraHer <span>AI</span>
        </Link>
        <span className="eyebrow">
          {signup ? "Create your private account" : "Welcome back"}
        </span>
        <h1 id="auth-title">
          {signup ? "Access ÌleraHer with your phone number." : "Sign in to ÌleraHer."}
        </h1>
        <p className="muted">
          {signup
            ? "Use a phone number you can remember. Your password is stored securely and is never shown back to you."
            : "Enter the phone number and password you used when creating your account."}
        </p>

        <form className="authForm" onSubmit={submit}>
          <label>
            Phone number
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
            Password
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
              Confirm password
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
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="authSwitch">
          {signup ? "Already have an account?" : "New to ÌleraHer?"}{" "}
          <Link href={signup ? "/login" : "/signup"}>
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <small className="muted">
          ÌleraHer provides health information and does not replace professional medical care.
        </small>
      </section>
    </main>
  );
}
