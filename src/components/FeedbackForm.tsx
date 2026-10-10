"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useUI } from "@/lib/ui-language";
import Icon, { Flower } from "./Icon";
export default function FeedbackForm() {
  const { t } = useUI();
  const [rating, setRating] = useState<number>(),
    [category, setCategory] = useState<string>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          category: category || "general",
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true)
        throw new Error(data.error || t("saveError"));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="ux-feedback-success">
        <Flower size={100} />
        <Icon name="check" size={48} />
        <h1>{t("received")}</h1>
        <p>{t("receivedHint")}</p>
        <Link className="ux-button" href="/cycle">
          {t("myCycle")}
        </Link>
        <Link className="ux-secondary" href="/voice">
          {t("startChat")}
        </Link>
      </div>
    );
  return (
    <section className="ux-feedback">
      <Link href="/help" className="ux-text-button">
        <Icon name="back" />
        {t("feedback")}
      </Link>
      <div className="ux-feedback-intro">
        <Flower size={64} />
        <h1>{t("feedbackTitle")}</h1>
        <p className="ux-muted">{t("feedbackHint")}</p>
      </div>
      <form onSubmit={submit}>
        <fieldset>
          <legend>{t("feedbackTitle")}</legend>
          <div className="ux-feedback-faces">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                aria-label={`${n} / 5`}
                aria-pressed={rating === n}
                onClick={() => setRating(n)}
              >
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle
                    cx="24"
                    cy="24"
                    r="19"
                    fill={rating === n ? "var(--lilac)" : "var(--soft)"}
                  />
                  <circle cx="17" cy="19" r="1.2" fill="currentColor" />
                  <circle cx="31" cy="19" r="1.2" fill="currentColor" />
                  {n < 3 ? (
                    <path d={`M16 33 Q24 ${n === 1 ? 22 : 27} 32 33`} />
                  ) : n === 3 ? (
                    <path d="M16 30 H32" />
                  ) : (
                    <path d={`M15 28 Q24 ${n === 5 ? 43 : 38} 33 28`} />
                  )}
                </svg>
                <span>{n} / 5</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="ux-actions">
          {(
            [
              { value: "bug", label: "problem" },
              { value: "suggestion", label: "idea" },
              { value: "general", label: "loved" },
            ] as const
          ).map((c) => (
            <button
              className="ux-pill"
              type="button"
              key={c.value}
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {t(c.label)}
            </button>
          ))}
        </div>
        <label htmlFor="feedback-comment">{t("comment")}</label>
        <textarea
          id="feedback-comment"
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && (
          <p role="alert" className="ux-alert">
            {error}
          </p>
        )}
        <button
          className="ux-button"
          type="submit"
          disabled={
            busy ||
            !rating ||
            (message.trim().length > 0 && message.trim().length < 3)
          }
        >
          {busy ? t("sending") : t("sendFeedback")}
        </button>
        <p className="ux-info-box">
          <Icon name="lock" size={18} />
          {t("feedbackPrivacy")}
        </p>
      </form>
    </section>
  );
}
