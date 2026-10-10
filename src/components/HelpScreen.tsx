"use client";
import Link from "next/link";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import LanguagePicker from "./LanguagePicker";
import PhoneSupport from "./PhoneSupport";
import EnglishContent from "./EnglishContent";
export default function HelpScreen() {
  const { language } = useLanguage();
  return (
    <section className="panel taskPanel">
      <h1>{copy(language, "help")}</h1>
      <LanguagePicker />
      <p>{copy(language, "purpose")}</p>
      <EnglishContent>
        <h2>How to ask</h2>
        <ol>
          <li>Record a question in the selected language.</li>
          <li>Check what we heard. Record again if it is wrong.</li>
          <li>Confirm and ask, then read the answer. Listening is optional.</li>
        </ol>
        <p>
          Recording sends audio to the speech service before confirmation.
          Confirmation controls when you request an answer. Guided topics offer
          a tap alternative.
        </p>
        <Link className="btn" href="/voice">
          Open Ask
        </Link>
        <h2>How to log a period</h2>
        <p>
          Choose dates, add optional details, and review before saving. “Not
          provided” is different from no pain. You can change or delete a record
          from History.
        </p>
        <Link href="/log">Log a period</Link>
        <h2>Where records are saved</h2>
        <p>
          Health records and explicitly retained conversations are stored in
          this browser on this device, separated by account. Clearing browser
          data can remove them. Signing in does not recover records on another
          device. Download selected health records from History and restore them
          through Settings.
        </p>
        <h2>Language and audio</h2>
        <p>
          Use Nigerian English, Yorùbá, Hausa or Igbo. Playback needs an actual
          matching voice; you can read every answer. Newly added health-module
          copy is available in English while native-language and clinical review
          are pending.
        </p>
        <h2>Connection problems</h2>
        <p>
          Local forms, saved records and arithmetic can work in an already
          authenticated open session without a connection. New voice
          transcription and optional AI explanations need internet. Offline
          reload shows non-personal Help rather than bypassing sign-in.
        </p>
        <Link className="secondaryBtn" href="/lite">
          Use low-data mode
        </Link>
        <div className="notice" id="care">
          <h2>Getting healthcare help</h2>
          <p>
            Seek in-person medical care now for severe or worrying symptoms,
            fainting, very heavy bleeding, or pregnancy with pain or bleeding.
            If you think there is immediate danger, seek nearby emergency care.
            Use a provider contact you know; no emergency number is verified by
            this app.
          </p>
          <p>
            ÌleraHer cannot diagnose a condition, rule out pregnancy or confirm
            that a baby is healthy. Do not wait for an AI response to get care.
          </p>
        </div>
        <h2>Account support</h2>
        <p>
          Use your existing phone number and password. Password reset is not
          currently available in the app. Feedback must not include passwords,
          account credentials or private medical details.
        </p>
      </EnglishContent>
      <PhoneSupport />
      <p>
        <Link href="/feedback">{copy(language, "feedback")}</Link> ·{" "}
        <Link href="/settings">{copy(language, "settings")}</Link>
      </p>
    </section>
  );
}
