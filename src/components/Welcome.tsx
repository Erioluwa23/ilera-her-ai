"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useUI } from "@/lib/ui-language";
import Icon, { Flower } from "./Icon";
export default function Welcome() {
  const { t, language, setLanguage } = useUI(),
    router = useRouter(),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("ileraher-onboarding-v2") === "done") {
        const last =
          localStorage.getItem("ileraher-last-screen-v1") || "/cycle";
        router.replace(
          [
            "/cycle",
            "/voice",
            "/history",
            "/help",
            "/lite",
            "/settings/privacy",
          ].includes(last)
            ? last
            : "/cycle",
        );
        return;
      }
    } catch {}
    setReady(true);
  }, [router]);
  function finish(route: string) {
    try {
      localStorage.setItem("ileraher-onboarding-v2", "done");
    } catch {}
    router.push(route);
  }
  if (!ready)
    return (
      <p role="status" className="ux-loading">
        {t("loading")}
      </p>
    );
  return (
    <section className="ux-welcome">
      <Flower size={116} />
      <h1>ÌleraHer</h1>
      <h2>{t("yourRhythm")}</h2>
      <p>{t("trackTalk")}</p>
      <fieldset>
        <legend>{t("chooseLanguage")}</legend>
        <div className="ux-language-choices">
          {LANGUAGE_OPTIONS.map((x) => (
            <button
              key={x.code}
              className={language === x.code ? "is-active" : ""}
              aria-pressed={language === x.code}
              onClick={() => setLanguage(x.code)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button className="ux-btn ux-full" onClick={() => finish("/cycle")}>
        <Icon name="arrow" />
        {t("getStarted")}
      </button>
      <button className="ux-text-button" onClick={() => finish("/voice")}>
        {t("explore")}
      </button>
    </section>
  );
}
