import PhoneSupport from "@/components/PhoneSupport";
import Link from "next/link";
import AppShell from "@/components/AppShell";
export default function HelpPage() {
  return (
    <AppShell>
      <section className="panel">
        <span className="eyebrow">More ways to get support</span>
        <h1>Voice, wherever you are.</h1>
        <article className="selectedDay">
          <h2>Slow connection?</h2>
          <p>
            Use the simpler voice screen. Recording and answers still need an
            internet connection.
          </p>
          <Link className="btn" href="/lite" prefetch={false}>
            Open low-data voice →
          </Link>
        </article>
        <PhoneSupport />
        <div className="notice">
          <strong>When you need more care</strong>
          <p>
            ÌleraHer provides information, not a confirmed diagnosis. Seek
            in-person care for severe or worrying symptoms.
          </p>
        </div>
        <div className="screenActions">
          <Link className="secondaryBtn" href="/feedback">
            Share feedback
          </Link>
          <Link className="textlink linkbtn" href="/history">
            Manage your private logs →
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
