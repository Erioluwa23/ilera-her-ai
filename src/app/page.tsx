import Tracker from "@/components/Tracker";
import VoiceLog from "@/components/VoiceLog";
import AskIlera from "@/components/AskIlera";
import Consent from "@/components/Consent";
export default function Home(){
  return <main className="wrap">
    <Consent/>
    <nav className="nav"><div className="brand">ÌleraHer <span>AI</span></div><div className="navlinks"><a className="pill" href="/lite">Low-data mode</a><a className="pill" href="#tracker">Private by design</a></div></nav>
    <section className="hero"><div><span className="pill">Built for Nigerian women & girls</span><h1>Understand your cycle. In your own voice.</h1><p>Track your period, speak symptoms in Nigerian English, Yorùbá, Hausa or Igbo, and get source-grounded menstrual-health guidance.</p><a className="btn linkbtn" href="#tracker">Start tracking</a></div><div className="card"><div className="voice">🎙️</div><h3>N-ATLAS voice-first access</h3><p className="muted">Mobile voice, low-bandwidth web and IVR share one health-intelligence backend.</p><p className="pill">English · Yorùbá · Hausa · Igbo</p></div></section>
    <section className="grid"><article className="card"><h3>Interactive Voice Response</h3><p className="muted">Phone callers choose a language, record a question and receive a spoken health response.</p></article><article className="card"><h3>Low-bandwidth mode</h3><p className="muted">A minimal installable PWA route works on slower mobile connections and caches the core interface.</p></article><article className="card"><h3>N-ATLAS native AI</h3><p className="muted">Official N-ATLAS ASR models feed the multilingual N-ATLAS LLM with curated medical grounding.</p></article></section>
    <Tracker/><VoiceLog/><AskIlera/>
    <div className="notice"><strong>Health information, not a confirmed diagnosis.</strong> <span className="muted">Possible causes must be confirmed by a qualified healthcare professional. Seek in-person care for severe or worrying symptoms.</span></div>
    <footer>ÌleraHer AI · N-ATLAS voice-first health prototype</footer>
  </main>
}
