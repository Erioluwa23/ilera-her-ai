"use client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { answerQuestion, localizeHealthAnswer } from "@/lib/knowledge";
const TOPICS = [
  { id: "periods", question: "Tell me about first periods" },
  { id: "cramps", question: "Tell me about period cramps" },
  { id: "fertility", question: "Tell me about fertility awareness" },
] as const;
export default function GuidedTopics() {
  const { language } = useLanguage(),
    [topic, setTopic] = useState<string | null>(null);
  const result = topic
    ? localizeHealthAnswer(answerQuestion(topic, "en-NG"), language)
    : null;
  return (
    <div className="guidedTopics">
      <h2>{copy(language, "educationOnly")}</h2>
      <div className="screenActions">
        {TOPICS.map((x) => (
          <button
            className="secondaryBtn"
            key={x.id}
            onClick={() => setTopic(x.question)}
          >
            {copy(language, x.id)}
          </button>
        ))}
        <Link className="secondaryBtn" href="/late-period">
          Delayed period
        </Link>
      </div>
      {result && (
        <article className="selectedDay" lang={language}>
          <span className="pill">{copy(language, "basicGuidance")}</span>
          <p>{result.answer}</p>
          <ul>
            {result.nextSteps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>{result.disclaimer}</p>
          <details>
            <summary>{copy(language, "sources")}</summary>
            {result.sources.map((x) => (
              <p key={x.url}>
                <a href={x.url} target="_blank" rel="noreferrer">
                  {x.title}
                </a>
              </p>
            ))}
            <p>
              Existing source-based content; local clinical and native-language
              re-review pending. No personalized calendar calculation is made
              here.
            </p>
          </details>
          <button className="textbtn" onClick={() => setTopic(null)}>
            {copy(language, "back")}
          </button>
        </article>
      )}
    </div>
  );
}
