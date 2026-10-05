import Link from "next/link";
import VoiceLog from "./VoiceLog";
export default function LiteAsk() {
  return (
    <main className="lite liteVoice">
      <header>
        <Link className="brand" href="/" prefetch={false}>
          ÌleraHer <span>Lite</span>
        </Link>
        <Link href="/voice" prefetch={false}>
          Full app
        </Link>
      </header>
      <VoiceLog compact />
      <small>Voice support on slower connections. No typed questions.</small>
    </main>
  );
}
