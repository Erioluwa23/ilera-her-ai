"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import Icon, { Flower, type IconName } from "./Icon";
import { useUI, type UIKey } from "@/lib/ui-language";
const items: { href: string; icon: IconName; label: UIKey; match: string[] }[] =
  [
    {
      href: "/cycle",
      icon: "calendar",
      label: "cycle",
      match: ["/cycle", "/log"],
    },
    {
      href: "/voice",
      icon: "chat",
      label: "chat",
      match: ["/voice", "/chat", "/lite", "/voice-lite"],
    },
    {
      href: "/history",
      icon: "logs",
      label: "logs",
      match: ["/history", "/logs"],
    },
    {
      href: "/help",
      icon: "help",
      label: "help",
      match: ["/help", "/feedback", "/settings"],
    },
  ];
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    { t, language } = useUI();
  const chat = ["/voice", "/chat", "/lite", "/voice-lite"].some(
    (x) => path === x || path.startsWith(x + "/"),
  );
  const onboarding = path === "/";
  useEffect(() => {
    document.documentElement.lang = language;
    if (!onboarding) {
      try {
        localStorage.setItem("ileraher-last-screen-v1", path);
      } catch {}
    }
  }, [path, language, onboarding]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ux-app");
    const bar = root?.querySelector<HTMLElement>(".ux-bottomnav");
    if (!root || !bar || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      root.style.setProperty(
        "--navigation-height",
        `${bar.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, [onboarding]);
  function nav(className: string) {
    return (
      <nav className={className} aria-label={t("dailySpace")}>
        {items.map((x) => (
          <Link
            key={x.href}
            href={x.href}
            prefetch={false}
            aria-current={
              x.match.some((m) => path === m || path.startsWith(m + "/"))
                ? "page"
                : undefined
            }
          >
            <span>
              <Icon name={x.icon} />
            </span>
            <b>{t(x.label)}</b>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <div
      className={`ux-app${chat ? " ux-chat-app" : ""}${onboarding ? " ux-onboarding-app" : ""}`}
    >
      <a className="ux-skip" href="#screen">
        {t("getStarted")}
      </a>
      <aside className="ux-sidebar">
        <Link className="ux-brand" href="/cycle">
          <Flower />
          <strong>ÌleraHer</strong>
        </Link>
        <p className="ux-eyebrow">{t("dailySpace")}</p>
        {nav("ux-side-nav")}
        <Link className="ux-space-card" href="/settings/privacy">
          <span className="ux-icon-circle">
            <Icon name="lock" />
          </span>
          <span>
            <strong>{t("space")}</strong>
            <small>{t("privacyLanguage")}</small>
          </span>
          <Icon name="arrow" />
        </Link>
      </aside>
      {!chat && !onboarding && (
        <header className="ux-topbar">
          <Link className="ux-brand" href="/cycle">
            <Flower size={32} />
            <strong>ÌleraHer</strong>
          </Link>
          <Link
            className="ux-icon-button"
            href="/settings/privacy"
            aria-label={t("privacyLanguage")}
          >
            <Icon name="lock" />
          </Link>
        </header>
      )}
      <main id="screen" className="ux-main">
        {children}
      </main>
      {!onboarding && nav("ux-bottomnav")}
    </div>
  );
}
