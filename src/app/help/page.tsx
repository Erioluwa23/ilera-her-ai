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
        <article className="selectedDay">
          <span className="pill">Phone calls · Coming soon</span>
          <h2>Call from an ordinary phone</h2>
          <ol className="ivrSteps">
            <li>Choose Yorùbá, Hausa, Igbo or English</li>
            <li>Record your concern after the beep</li>
            <li>Listen to the response</li>
          </ol>
          <p className="muted">
            A support number is not available yet. Call charges may apply when
            the service launches.
          </p>
        </article>
        <div className="notice">
          <strong>When you need more care</strong>
          <p>
            ÌleraHer provides information, not a confirmed diagnosis. Seek
            in-person care for severe or worrying symptoms.
          </p>
        </div>
        <Link className="textlink linkbtn" href="/history">
          Manage your private logs →
        </Link>
      </section>
    </AppShell>
  );
}
