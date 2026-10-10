"use client";
import Link from "next/link";
import { capabilities } from "@/lib/capabilities";
import { useLanguage } from "@/lib/use-language";
import { copy, type CopyKey } from "@/lib/ui-copy";
export default function TrackHub() {
  const { language } = useLanguage();
  return (
    <section>
      <span className="eyebrow">{copy(language, "onDevice")}</span>
      <h1>{copy(language, "track")}</h1>
      <div className="moduleCards">
        {capabilities()
          .filter((x) => x.state !== "hidden")
          .map((x) => (
            <Link
              className="moduleCard"
              key={x.id}
              href={x.route}
              prefetch={false}
            >
              <span className="moduleIcon" aria-hidden="true">
                {x.id === "periods"
                  ? "◷"
                  : x.id === "pregnancy"
                    ? "♡"
                    : x.id === "growth"
                      ? "↗"
                      : "◇"}
              </span>
              <h2>{copy(language, x.labelKey as CopyKey)}</h2>
              <span className="pill">
                {copy(
                  language,
                  x.state === "record_only"
                    ? "recordOnly"
                    : x.state === "education_only"
                      ? "educationOnly"
                      : "onDevice",
                )}
              </span>
              <span className="cardArrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
      </div>
    </section>
  );
}
