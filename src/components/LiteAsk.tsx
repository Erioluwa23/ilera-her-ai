"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import GuidedTopics from "./GuidedTopics";
import LanguagePicker from "./LanguagePicker";
import EnglishContent from "./EnglishContent";
const VoiceLog = dynamic(() => import("./VoiceLog"), {
  loading: () => <p role="status">Opening voice controls…</p>,
});
export default function LiteAsk() {
  const [voice, setVoice] = useState(false),
    { language } = useLanguage();
  return (
    <main className="lite liteVoice">
      <header>
        <Link className="brand" href="/home" prefetch={false}>
          ÌleraHer <span>Lite</span>
        </Link>
        <Link href="/voice" prefetch={false}>
          Full app
        </Link>
      </header>
      <h1>{copy(language, "ask")}</h1>
      <LanguagePicker />
      <EnglishContent>
        <p>
          Local records and saved information use the same data rules. New
          transcription and answers need internet. Voice controls load only when
          you choose them.
        </p>
      </EnglishContent>
      <div className="screenActions">
        <Link className="secondaryBtn" href="/log" prefetch={false}>
          {copy(language, "logPeriod")}
        </Link>
        <Link className="secondaryBtn" href="/history" prefetch={false}>
          {copy(language, "history")}
        </Link>
        <Link href="/help" prefetch={false}>
          {copy(language, "help")}
        </Link>
        <Link href="/settings" prefetch={false}>
          {copy(language, "settings")}
        </Link>
      </div>
      {voice ? (
        <VoiceLog compact />
      ) : (
        <>
          <button className="btn" onClick={() => setVoice(true)}>
            {copy(language, "recordQuestion")}
          </button>
          <GuidedTopics />
        </>
      )}
    </main>
  );
}
