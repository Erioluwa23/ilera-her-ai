"use client";
import Link from "next/link";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useLanguage } from "@/lib/use-language";
export default function Welcome() {
  const { language, setLanguage } = useLanguage();
  return (
    <section className="welcomeScreen panel">
      <span className="eyebrow">Welcome to ÌleraHer</span>
      <h1>
        Menstrual support,
        <br />
        in your language.
      </h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="welcomeArt"
        src="/images/welcome.webp"
        width="480"
        height="270"
        alt="Woman in a green headwrap and lemon-coloured top"
      />
      <h2>Choose your language</h2>
      <p className="muted">Speak comfortably. You can change this anytime.</p>
      <div
        className="welcomeLanguages"
        role="group"
        aria-label="Choose language"
      >
        {LANGUAGE_OPTIONS.map((x) => (
          <button
            key={x.code}
            className={
              language === x.code ? "languageChoice active" : "languageChoice"
            }
            aria-pressed={language === x.code}
            onClick={() => setLanguage(x.code)}
          >
            <span>{x.label}</span>
            <span aria-hidden="true">{language === x.code ? "●" : "○"}</span>
          </button>
        ))}
      </div>
      <Link className="btn linkbtn fullWidth" href="/voice" prefetch={false}>
        Continue to voice support →
      </Link>
      <Link className="textlink" href="/cycle" prefetch={false}>
        View my cycle
      </Link>
    </section>
  );
}
