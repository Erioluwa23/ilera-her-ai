"use client";
import Link from "next/link";
import type { HealthResult } from "@/lib/health/result-schema";
import { displayDate } from "@/lib/health/date-only";
import { copy } from "@/lib/ui-copy";
const ACTIONS: Record<string, { href: string; label: string }> = {
  help: { href: "/help#care", label: "Get healthcare help" },
  track: { href: "/track", label: "View trackers" },
  history: { href: "/history", label: "View saved records" },
  period: { href: "/log", label: "Add a period record" },
};
export default function HealthResultCard({
  title,
  result,
  children,
}: {
  title: string;
  result: HealthResult;
  children?: React.ReactNode;
}) {
  const action = result.allowedActionIds.map((x) => ACTIONS[x]).find(Boolean);
  return (
    <article className="selectedDay" lang={result.language}>
      <span className="pill">
        {result.status === "record_only"
          ? copy(result.language, "recordOnly")
          : result.status === "needs_input"
            ? copy(result.language, "notProvided")
            : "Recorded facts"}
      </span>
      <h2>{title}</h2>
      {["emergency", "prompt_assessment"].includes(result.careAction) && (
        <p className="risk urgent">
          Seek in-person care for current severe or worrying symptoms.{" "}
          <Link href="/help#care">Get help</Link>
        </p>
      )}
      {result.explanation?.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <dl className="reviewSummary">
        {result.facts.map((f) => (
          <div key={f.id}>
            <dt>{f.basis}</dt>
            <dd>
              {f.displayToken}
              {f.estimated ? " · Estimate" : ""}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      {action && (
        <p>
          <Link className="secondaryBtn" href={action.href}>
            {action.label}
          </Link>
        </p>
      )}
      <details>
        <summary>How this was worked out</summary>
        <p>
          Method: {result.calculation.methodVersion} ·{" "}
          {displayDate(result.calculation.asOfDate, result.language)}
        </p>
        <p>{result.calculation.eligibilityReasons.join(" ")}</p>
        <p>
          Input records: {result.calculation.recordIds.length}. Reference:{" "}
          {result.calculation.referenceVersion ||
            "No reference comparison used."}
        </p>
      </details>
    </article>
  );
}
