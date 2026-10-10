"use client";
import { daysBetween } from "@/lib/health/date-only";
import type { Measurement } from "@/lib/health/records";
export default function MeasurementPlot({
  records,
}: {
  records: Measurement[];
}) {
  if (!records.length) return null;
  const points = [...records].sort((a, b) => a.date.localeCompare(b.date)),
    span = Math.max(1, daysBetween(points[0].date, points.at(-1)!.date)),
    values = points.map((x) => x.normalized),
    lo = Math.min(...values),
    hi = Math.max(...values),
    height = Math.max(1, hi - lo);
  return (
    <figure>
      <svg
        viewBox="0 0 500 210"
        role="img"
        aria-label="Saved measurement points. The same values are in the table below."
      >
        <path d="M40 15V175H480" fill="none" stroke="#5b7064" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle
              cx={40 + (daysBetween(points[0].date, p.date) / span) * 420}
              cy={160 - ((p.normalized - lo) / height) * 130}
              r="5"
              fill="#164b35"
            />
            <title>
              {p.date}: {p.normalized} {p.measure === "weight" ? "kg" : "cm"}
            </title>
            {i === 0 && (
              <text x="40" y="202" fontSize="14" fill="#164b35">
                {p.date}
              </text>
            )}
          </g>
        ))}
        <text x="480" y="202" textAnchor="end" fontSize="14" fill="#164b35">
          {points.at(-1)!.date}
        </text>
      </svg>
      <figcaption>
        Recorded points only. Gaps are unmeasured. This plot does not predict
        future growth or compare with a reference.
      </figcaption>
    </figure>
  );
}
