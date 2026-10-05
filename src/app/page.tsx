import Link from "next/link";
import Tracker from "@/components/Tracker";
import VoiceLog from "@/components/VoiceLog";
import AskIlera from "@/components/AskIlera";
import Consent from "@/components/Consent";

export default function Home() {
  return (
    <main className="wrap" id="home">
      <a className="skiplink" href="#tracker">
        Skip to your cycle
      </a>
      <Consent />
      <nav className="nav" aria-label="Main navigation">
        <Link className="brand" href="/" prefetch={false}>
          ÌleraHer <span>AI</span>
        </Link>
        <div className="navlinks">
          <a href="#tracker">My cycle</a>
          <a href="#voice">Ask privately</a>
          <Link className="pill" href="/lite" prefetch={false}>
            Low-data mode ↗
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="pill">Your body. Your language. Your pace.</span>
          <h1>
            Menstrual support,
            <br />
            in your language.
          </h1>
          <p>
            A little clarity, whenever you need it. Keep track of your periods
            and ask about changes in Nigerian English, Yorùbá, Hausa or Igbo.
          </p>
          <div className="heroactions">
            <a className="btn linkbtn" href="#tracker">
              Log my period →
            </a>
            <a className="secondaryBtn linkbtn" href="#voice">
              Ask a question
            </a>
          </div>
          <p className="herofoot">
            Private by choice · Simple on slow connections
          </p>
        </div>
        <aside className="welcomeCard">
          {/* A small local illustration keeps this screen independent of external image services. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="welcomeArt"
            src="/images/welcome.webp"
            width="480"
            height="320"
            alt="Illustration of a woman in a green headwrap and lemon-coloured top"
          />
          <div>
            <span className="eyebrow">Welcome to ÌleraHer</span>
            <h2>Feel comfortable asking.</h2>
            <p className="muted">
              Speak or type. Choose the language that feels right for you.
            </p>
            <a className="textlink" href="#voice">
              Choose your language →
            </a>
          </div>
        </aside>
      </section>
      <Tracker />
      <div className="supportGrid">
        <VoiceLog />
        <AskIlera />
      </div>
      <section
        className="grid accessGrid"
        id="help"
        aria-label="More ways to get support"
      >
        <article className="card">
          <span className="eyebrow">Low-bandwidth access</span>
          <h2>Less data. The same care.</h2>
          <p className="muted">
            A simpler screen for slower connections. Speak or type your
            question; answers need an internet connection.
          </p>
          <Link className="btn linkbtn" href="/lite" prefetch={false}>
            Open ÌleraHer Lite →
          </Link>
        </article>
        <article className="card ivrCard">
          <span className="eyebrow">Phone-call support · Coming soon</span>
          <h2>A familiar voice, on any phone.</h2>
          <p className="muted">
            Planned call journey: choose a language, describe your concern, then
            listen to guidance.
          </p>
          <ol className="ivrSteps">
            <li>Choose: Yorùbá, Hausa, Igbo or English</li>
            <li>Record your question after the beep</li>
            <li>Listen to the response</li>
          </ol>
          <p className="muted small">
            A support number is not available yet. Call charges may apply when
            the service launches.
          </p>
        </article>
      </section>
      <div className="notice">
        <strong>Health information supports professional care.</strong>
        <p className="muted">
          ÌleraHer helps you understand and record changes. It does not confirm
          a diagnosis. Seek in-person care for severe or worrying symptoms.
        </p>
      </div>
      <footer>
        <a className="brand" href="#home">
          ÌleraHer <span>AI</span>
        </a>
        <p>Private by choice · Voice or text · In your language</p>
      </footer>
      <nav className="mobileNav" aria-label="Mobile navigation">
        <a href="#home">
          ⌂<span>Home</span>
        </a>
        <a href="#tracker">
          ▤<span>Logs</span>
        </a>
        <a href="#voice">
          ◉<span>Ask</span>
        </a>
        <a href="#help">
          ?<span>Help</span>
        </a>
      </nav>
    </main>
  );
}
