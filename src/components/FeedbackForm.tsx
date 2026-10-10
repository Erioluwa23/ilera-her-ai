"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";

export default function FeedbackForm() {
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, category, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error || "Could not submit feedback.");
        return;
      }
      setMessage("");
      setRating(null);
      setCategory("general");
      setStatus("Thank you. Your feedback has been saved.");
    } catch {
      setStatus("Could not connect. Please try again.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="feedbackForm" onSubmit={submit}>
      <fieldset className="feedbackRating">
        <legend>How was your experience?</legend>
        <div className="ratingButtons">
          {[1, 2, 3, 4, 5].map((value) => (
            <label className="radioChoice" key={value}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                required
              />
              {value}★
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        What is your feedback about?
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="general">General experience</option>
          <option value="voice">Voice assistant</option>
          <option value="cycle">Cycle tracking</option>
          <option value="language">Language support</option>
          <option value="low-data">Low-data mode</option>
          <option value="bug">Something is not working</option>
          <option value="suggestion">Suggestion</option>
        </select>
      </label>

      <label>
        Tell us what happened or what we should improve
        <textarea
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Your feedback helps us improve ÌleraHer."
          required
        />
      </label>

      {status && (
        <p className="statusBox" role="status">
          {status}
        </p>
      )}
      {status.startsWith("Thank you") && <Link href="/home">Return Home</Link>}
      <button
        className="btn"
        type="submit"
        disabled={busy || rating === null || message.trim().length < 3}
      >
        {busy ? "Sending…" : "Send feedback"}
      </button>
      <small className="muted">
        Please do not include private medical details in feedback. Use the voice
        assistant for health questions.
      </small>
    </form>
  );
}
