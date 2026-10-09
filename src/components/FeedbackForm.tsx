"use client";

import { FormEvent, useState } from "react";

export default function FeedbackForm() {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setRating(5);
      setCategory("general");
      setStatus("Thank you. Your feedback has been saved.");
    } catch {
      setStatus("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="feedbackForm" onSubmit={submit}>
      <fieldset className="feedbackRating">
        <legend>How was your experience?</legend>
        <div className="ratingButtons" role="radiogroup" aria-label="Experience rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={rating === value ? "active" : ""}
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
            >
              {value}★
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        What is your feedback about?
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
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

      {status && <p className="statusBox" role="status">{status}</p>}
      <button className="btn" type="submit" disabled={busy || message.trim().length < 3}>
        {busy ? "Sending…" : "Send feedback"}
      </button>
      <small className="muted">
        Please do not include private medical details in feedback. Use the voice assistant for health questions.
      </small>
    </form>
  );
}
