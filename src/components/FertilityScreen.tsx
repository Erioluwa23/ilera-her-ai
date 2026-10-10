"use client";
import { useState } from "react";
import Link from "next/link";
import { useToday } from "@/lib/use-today";
import { useHealthData } from "@/lib/health-store";
import {
  fertilityEstimate,
  type CycleContext,
} from "@/lib/health/cycle-calculations";
import { displayDate } from "@/lib/health/date-only";
import { POLICIES, publishable } from "@/lib/health/policies";
import EnglishContent from "./EnglishContent";
export default function FertilityScreen() {
  const store = useHealthData(),
    [inputs, setInputs] = useState<CycleContext>({
      regular: null,
      pregnancy: null,
      postpartum: null,
      hormonal: null,
    }),
    [review, setReview] = useState(false),
    today = useToday(),
    result = fertilityEstimate(store.data.periods, today, inputs),
    ready = publishable(POLICIES.fertility, today);
  const questions = [
    { id: "regular", label: "Are your usual cycles regular?" },
    { id: "pregnancy", label: "Is pregnancy known or suspected?" },
    {
      id: "postpartum",
      label: "Are you in a postpartum or breastfeeding transition?",
    },
    {
      id: "hormonal",
      label: "Do hormonal medicines or contraception affect your cycles?",
    },
  ] as const;
  return (
    <section className="panel taskPanel">
      <h1>Fertility information</h1>
      <EnglishContent>
        <p>
          Period dates do not confirm ovulation. Pregnancy can still occur
          outside a calendar estimate. A calendar estimate must not be used as a
          guarantee or a percentage chance of pregnancy.
        </p>
        <p>
          Personal calendar windows await local clinical and language review.
          Period recording and general information remain available.
        </p>
        {store.error && <p role="alert">{store.error}</p>}
        {!review ? (
          <>
            <p>
              You can review which information the calendar method would need.
              Nothing is saved by selecting these choices.
            </p>
            {questions.map((q) => (
              <label key={q.id}>
                {q.label}
                <select
                  value={
                    inputs[q.id] === null
                      ? "unknown"
                      : inputs[q.id]
                        ? "yes"
                        : "no"
                  }
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      [q.id]:
                        e.target.value === "unknown"
                          ? null
                          : e.target.value === "yes",
                    })
                  }
                >
                  <option value="unknown">Not sure</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            ))}
            <button className="btn" onClick={() => setReview(true)}>
              Review inputs and availability
            </button>
          </>
        ) : (
          <div className="selectedDay">
            <h2>
              {ready && result.start
                ? "Estimated calendar window"
                : "Unable to offer a calendar estimate"}
            </h2>
            {questions.map((q) => (
              <p key={q.id}>
                {q.label}{" "}
                {inputs[q.id] === null
                  ? "Not sure"
                  : inputs[q.id]
                    ? "Yes"
                    : "No"}
              </p>
            ))}
            {ready && result.start && result.end && (
              <p>
                {displayDate(result.start)} – {displayDate(result.end)}.{" "}
                {result.status === "within_estimated_calendar_window"
                  ? "These are estimated days when conception may be more likely."
                  : "This is outside the calendar estimate. Pregnancy can still occur."}
              </p>
            )}
            <p>Records checked: {store.data.periods.length} period starts.</p>
            <p>
              {!ready
                ? "Clinical sign-off of the method, history gates and translations is pending. "
                : ""}
              {result.reasons.map((x) => x.replaceAll("_", " ")).join("; ")}
            </p>
            <button className="secondaryBtn" onClick={() => setReview(false)}>
              Change answers
            </button>
          </div>
        )}
        <div className="screenActions">
          <Link className="btn" href="/cycle">
            Review period history
          </Link>
          <Link className="textlink" href="/conception">
            Trying-to-conceive records
          </Link>
          <Link className="textlink" href="/late-period">
            Delayed-period help
          </Link>
        </div>
        <details>
          <summary>Method and sources</summary>
          <p>
            Candidate: Standard Days–based calendar, days 8–19. Proposed history
            gate: six confirmed contiguous cycles, every interval 26–32 days in
            the preceding year. These gates are product proposals, not clinical
            validation.
          </p>
          <a
            href="https://www.cdc.gov/contraception/hcp/usspr/standard-days-method.html"
            target="_blank"
            rel="noreferrer"
          >
            CDC Standard Days Method
          </a>
        </details>
      </EnglishContent>
    </section>
  );
}
