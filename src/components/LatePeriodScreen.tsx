"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useHealthData } from "@/lib/health-store";
import { validDate, displayDate } from "@/lib/health/date-only";
import type { TestRecord } from "@/lib/health/records";
import { answerQuestion, localizeHealthAnswer } from "@/lib/knowledge";
import { useLanguage } from "@/lib/use-language";
import EnglishContent from "./EnglishContent";
export default function LatePeriodScreen({ recordId }: { recordId?: string }) {
  const store = useHealthData(),
    { language } = useLanguage(),
    [step, setStep] = useState(0),
    [answers, setAnswers] = useState<string[]>(Array(3).fill("unsure")),
    [date, setDate] = useState(""),
    [sexDate, setSexDate] = useState(""),
    [result, setResult] = useState<TestRecord["result"] | "">(""),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    operation = useRef(""),
    lock = useRef(false),
    today = useToday();
  const original = store.data.tests.find((x) => x.id === recordId),
    loadedId = useRef("");
  useEffect(() => {
    if (original && loadedId.current !== original.id) {
      loadedId.current = original.id;
      operation.current = original.id;
      setDate(original.date);
      setResult(original.result);
      setSexDate(original.sexDate || "");
      setReview(true);
    }
  }, [original]);
  const questions = [
      "Are you having current severe pain, fainting or very heavy bleeding?",
      "Could pregnancy be possible?",
      "Have you missed three periods in a row?",
    ],
    safety = answers[0] !== "no",
    guidance = localizeHealthAnswer(
      answerQuestion("My period is late", "en-NG"),
      language,
    );
  function validate() {
    if (
      !validDate(date) ||
      date > today ||
      !result ||
      (sexDate && (!validDate(sexDate) || sexDate > date))
    ) {
      setMessage(
        "Check the test date, result and optional event date. Actual events cannot be in the future.",
      );
      return false;
    }
    setMessage("");
    return true;
  }
  async function save() {
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    operation.current ||= crypto.randomUUID();
    const x: TestRecord = {
      id: operation.current,
      date,
      result: result as TestRecord["result"],
      ...(sexDate ? { sexDate } : {}),
    };
    if (
      await store.commit((data) => ({
        ...data,
        tests: [...data.tests.filter((t) => t.id !== x.id), x],
      }))
    ) {
      setMessage(
        "Test result saved on this device. This does not establish a pregnancy record or rule out pregnancy.",
      );
      setReview(false);
      if (!recordId) {
        operation.current = "";
        setDate("");
        setResult("");
        setSexDate("");
      }
    }
    lock.current = false;
    setBusy(false);
  }
  return (
    <section className="panel taskPanel">
      <h1>Delayed-period help</h1>
      <EnglishContent>
        <p>
          Period timing does not identify the cause of a delay. Personal testing
          and care rules await local clinical review; existing basic guidance
          and record keeping remain available.
        </p>
        {safety && (
          <div className="risk urgent">
            <p>
              If you have current severe or worrying symptoms, fainting, very
              heavy bleeding, or possible pregnancy with pain or bleeding, seek
              in-person medical care. Do not wait for these questions or an AI
              answer.
            </p>
            <Link href="/help#care">Get healthcare help</Link>
          </div>
        )}
        {step < questions.length ? (
          <fieldset className="choiceGroup">
            <legend>{questions[step]}</legend>
            {["yes", "no", "unsure"].map((x) => (
              <label className="radioChoice" key={x}>
                <input
                  type="radio"
                  name="late-answer"
                  checked={answers[step] === x}
                  onChange={() =>
                    setAnswers((v) => v.map((old, i) => (i === step ? x : old)))
                  }
                />
                {x === "unsure" ? "Not sure" : x}
              </label>
            ))}
            <div className="screenActions">
              {step > 0 && (
                <button
                  className="secondaryBtn"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              <button className="btn" onClick={() => setStep(step + 1)}>
                Continue
              </button>
            </div>
          </fieldset>
        ) : (
          <div className="selectedDay">
            <h2>Review your answers</h2>
            {questions.map((q, i) => (
              <p key={q}>
                {q} · {answers[i]}
              </p>
            ))}
            <p>
              A completed questionnaire cannot rule out illness or pregnancy.
              Unknown answers remain unknown. No personalized expected date or
              retest interval is invented.
            </p>
            <button className="secondaryBtn" onClick={() => setStep(0)}>
              Change answers
            </button>
          </div>
        )}
      </EnglishContent>
      {step >= questions.length && (
        <article className="selectedDay" lang={language}>
          <h2>Basic guidance</h2>
          <p>{guidance.answer}</p>
          <ul>
            {guidance.nextSteps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>{guidance.disclaimer}</p>
        </article>
      )}
      <EnglishContent>
        <details open={recordId ? true : undefined}>
          <summary>Record a test result</summary>
          {review ? (
            <>
              <h2>Review before saving</h2>
              <p>
                Test: {displayDate(date)} · {result}
              </p>
              <p>
                Optional latest unprotected-sex event:{" "}
                {sexDate ? displayDate(sexDate) : "Not provided"}
              </p>
              <p>
                A negative early result cannot exclude pregnancy from that
                event. Newer events have their own timeline.
              </p>
              <button className="secondaryBtn" onClick={() => setReview(false)}>
                Change
              </button>
              <button className="btn" disabled={busy} onClick={save}>
                Save test result
              </button>
            </>
          ) : (
            <div className="taskPanel">
              <label>
                Test date
                <input
                  type="date"
                  max={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Test result
                <select
                  value={result}
                  onChange={(e) => setResult(e.target.value as typeof result)}
                >
                  <option value="">Choose result</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="unclear">Unclear</option>
                </select>
              </label>
              <label>
                Latest unprotected-sex event date (optional)
                <input
                  type="date"
                  max={date || today}
                  value={sexDate}
                  onChange={(e) => setSexDate(e.target.value)}
                />
              </label>
              <button
                className="btn"
                onClick={() => {
                  if (validate()) setReview(true);
                }}
              >
                Review test record
              </button>
            </div>
          )}
        </details>
        {message && <p role="status">{message}</p>}
        {store.error && <p role="alert">{store.error}</p>}
        <p>
          <Link href="/history">
            Review and export selected records to show your provider
          </Link>
          . The app does not contact or book a provider.
        </p>
        <p>
          <Link href="/help#care">Get healthcare help</Link>
        </p>
      </EnglishContent>
    </section>
  );
}
