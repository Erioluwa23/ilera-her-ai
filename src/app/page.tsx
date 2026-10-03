import Tracker from "@/components/Tracker";
import VoiceLog from "@/components/VoiceLog";
import AskIlera from "@/components/AskIlera";
import Consent from "@/components/Consent";

export default function Home(){
  return <main className="wrap">
    <Consent/>
    <nav className="nav">
      <div className="brand">ÌleraHer <span>AI</span></div>
      <div className="navlinks">
        <a className="pill" href="#voice">Speak now</a>
        <a className="pill" href="/lite">Low-data voice</a>
      </div>
    </nav>

    <section className="hero voiceHero">
      <div>
        <span className="pill">Voice-first menstrual health access</span>
        <h1>Speak. Be understood. Get guidance in your language.</h1>
        <p>Use Nigerian English, Yorùbá, Hausa or Igbo by voice. ÌleraHer routes speech through the matching official N-ATLAS ASR model, keeps the selected language through health grounding, and returns a language-specific response.</p>
        <a className="btn linkbtn" href="#voice">Start with your voice</a>
      </div>
      <div className="card voiceAccessCard">
        <div className="voice">🎙️</div>
        <h3>Three voice-first access channels</h3>
        <p className="muted">Mobile microphone · low-bandwidth voice mode · phone IVR</p>
        <p className="pill">Nigerian English · Yorùbá · Hausa · Igbo</p>
      </div>
    </section>

    <VoiceLog/>

    <section className="grid accessGrid">
      <article className="card">
        <span className="eyebrow">1 · Mobile voice</span>
        <h3>Speak directly in the app</h3>
        <p className="muted">Tap the microphone, choose your language, speak a menstrual-health question, and receive a grounded response.</p>
        <a className="textlink" href="#voice">Use voice</a>
      </article>
      <article className="card">
        <span className="eyebrow">2 · IVR</span>
        <h3>Interactive Voice Response</h3>
        <p className="muted">Callers choose English, Yorùbá, Hausa or Igbo, record a question after the beep, and the same N-ATLAS health pipeline processes it.</p>
      </article>
      <article className="card">
        <span className="eyebrow">3 · Low data</span>
        <h3>Voice on slower connections</h3>
        <p className="muted">The lightweight mobile route keeps voice input while removing the heavier interface for slower networks and basic smartphones.</p>
        <a className="textlink" href="/lite">Open low-data voice mode</a>
      </article>
    </section>

    <section className="secondaryModes">
      <div className="sectionIntro">
        <span className="eyebrow">Secondary access</span>
        <h2>Tracking and typed questions are still available</h2>
        <p className="muted">Voice is the primary path. These tools support users who prefer typing or want to keep a private cycle history.</p>
      </div>
      <Tracker/>
      <AskIlera/>
    </section>

    <div className="notice"><strong>Health information, not a confirmed diagnosis.</strong> <span className="muted">Possible causes must be confirmed by a qualified healthcare professional. Seek in-person care for severe or worrying symptoms.</span></div>
    <footer>ÌleraHer AI · N-ATLAS voice-first health prototype</footer>
  </main>
}
