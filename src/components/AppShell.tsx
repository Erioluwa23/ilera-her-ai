"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Consent from "./Consent";
import LogoutButton from "./LogoutButton";
const ITEMS = [
  { href: "/cycle", icon: "⌂", label: "My cycle" },
  { href: "/voice", icon: "◉", label: "Speak" },
  { href: "/history", icon: "▤", label: "My logs" },
  { href: "/help", icon: "?", label: "Help" },
  { href: "/feedback", icon: "✦", label: "Feedback" },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="wrap appWrap">
      <a className="skiplink" href="#screen">
        Skip to screen
      </a>
      <Consent />
      <header className="nav">
        <Link className="brand" href="/" prefetch={false}>
          ÌleraHer <span>AI</span>
        </Link>
        <nav className="desktopNav" aria-label="Main navigation">
          {ITEMS.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              prefetch={false}
              aria-current={path === x.href ? "page" : undefined}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <div className="navAccount">
          <Link className="pill" href="/lite" prefetch={false}>
            Low-data voice ↗
          </Link>
          <Link className="pill adminShortcut" href="/admin" prefetch={false}>Admin</Link>
          <LogoutButton />
        </div>
      </header>
      <main id="screen" className="appScreen">
        {children}
      </main>
      <footer>
        <p>Private by choice · In your language</p>
        <small>Health information supports professional care.</small>
      </footer>
      <nav className="mobileNav" aria-label="Mobile navigation">
        {ITEMS.map((x) => (
          <Link
            key={x.href}
            href={x.href}
            prefetch={false}
            aria-current={path === x.href ? "page" : undefined}
          >
            {x.icon}
            <span>{x.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
