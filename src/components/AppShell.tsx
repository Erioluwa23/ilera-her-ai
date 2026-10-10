"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useOwner, usePreferences } from "@/lib/experience";
import { useLanguage } from "@/lib/use-language";
import { copy, type CopyKey } from "@/lib/ui-copy";
import { safeReturn } from "@/lib/return-route";
const ITEMS: { href: string; icon: string; label: CopyKey }[] = [
  { href: "/home", icon: "⌂", label: "home" },
  { href: "/track", icon: "▦", label: "track" },
  { href: "/voice", icon: "◉", label: "ask" },
  { href: "/history", icon: "▤", label: "history" },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { prefs } = usePreferences();
  const items = ITEMS.map((x) =>
    x.label === "ask" && prefs.lowData ? { ...x, href: "/lite" } : x,
  );
  const path = usePathname(),
    owner = useOwner(),
    { language } = useLanguage(),
    [offline, setOffline] = useState(false),
    [expired, setExpired] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    const check = async () => {
      try {
        const r = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (r.status === 401) {
          setExpired(true);
          window.speechSynthesis?.cancel();
          window.dispatchEvent(new Event("ileraher-session-ended"));
          location.replace(
            "/login?next=" + encodeURIComponent(safeReturn(path)),
          );
        }
      } catch {
        /* Existing session remains subject to its server expiration. */
      }
    };
    const timer = setInterval(check, 60000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [owner, path]);
  function active(href: string) {
    return href === "/track"
      ? [
          "/track",
          "/cycle",
          "/log",
          "/pregnancy",
          "/baby",
          "/growth",
          "/fertility",
          "/conception",
          "/late-period",
        ].includes(path)
      : href === "/voice" || href === "/lite"
        ? ["/voice", "/lite"].includes(path)
        : path === href;
  }
  return (
    <div className="wrap appWrap">
      <a className="skiplink" href="#screen">
        {copy(language, "skip")}
      </a>
      <header className="nav">
        <Link
          className="brand"
          href={owner ? "/home" : "/login"}
          prefetch={false}
        >
          ÌleraHer <span>AI</span>
        </Link>
        {owner && (
          <nav className="desktopNav" aria-label={copy(language, "home")}>
            {items.map((x) => (
              <Link
                key={x.href}
                href={x.href}
                prefetch={false}
                aria-current={active(x.href) ? "page" : undefined}
              >
                {copy(language, x.label)}
              </Link>
            ))}
          </nav>
        )}
        <div className="navAccount">
          <Link className="secondaryBtn" href="/help" prefetch={false}>
            {copy(language, "help")}
          </Link>
          <Link
            className="settingsLink"
            href={owner ? "/settings" : "/login"}
            prefetch={false}
          >
            {copy(language, owner ? "settings" : "signIn")}
          </Link>
        </div>
      </header>
      {offline && (
        <p className="statusBox" role="status">
          {copy(language, "offline")}
        </p>
      )}
      <main
        id="screen"
        className="appScreen"
        tabIndex={-1}
        aria-label={path === "/voice" ? copy(language, "ask") : undefined}
      >
        {expired ? <p role="alert">Please sign in again.</p> : children}
      </main>
      <footer>
        <p>ÌleraHer · {copy(language, "onDevice")}</p>
      </footer>
      {owner && (
        <nav className="mobileNav" aria-label={copy(language, "home")}>
          {items.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              prefetch={false}
              aria-current={active(x.href) ? "page" : undefined}
            >
              <span className="navIcon" aria-hidden="true">
                {x.icon}
              </span>
              <span>{copy(language, x.label)}</span>
            </Link>
          ))}
        </nav>
      )}
      <span className="srOnly" role="status" aria-live="polite" key={path}>
        {ITEMS.find((x) => active(x.href))?.label
          ? copy(language, ITEMS.find((x) => active(x.href))!.label)
          : path.slice(1)}
      </span>
    </div>
  );
}
