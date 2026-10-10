"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LanguagePicker from "./LanguagePicker";
import EnglishContent from "./EnglishContent";
import { usePreferences } from "@/lib/experience";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { safeReturn } from "@/lib/return-route";
export default function Welcome({ returnTo = "/home" }: { returnTo?: string }) {
  const { prefs, update, error } = usePreferences(),
    { language } = useLanguage(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [focus, setFocus] = useState(prefs.focus),
    [shared, setShared] = useState(prefs.sharedDevice),
    [retention, setRetention] = useState(prefs.conversationRetention);
  function finish() {
    if (
      update({
        focus,
        sharedDevice: shared,
        conversationRetention: shared ? "session" : retention,
        onboardingVersionCompleted: 1,
      })
    )
      router.replace(
        safeReturn(returnTo, "/home") === "/"
          ? "/home"
          : safeReturn(returnTo, "/home"),
      );
  }
  return (
    <section className="panel taskPanel">
      <span className="eyebrow">ÌleraHer · {step + 1}/3</span>
      <h1>
        {step === 0
          ? copy(language, "purpose")
          : step === 1
            ? copy(language, "focus")
            : copy(language, "privacy")}
      </h1>
      {step === 0 && (
        <>
          <LanguagePicker />
          <EnglishContent>
            <p>Record → Check what we heard → Get an answer.</p>
            <p>
              Saved health records stay in this browser. Voice recordings go to
              the speech service for transcription. Optional AI explanations use
              necessary confirmed information.
            </p>
            <p>Signing in does not back up your local records.</p>
          </EnglishContent>
        </>
      )}
      {step === 1 && (
        <fieldset className="choiceGroup">
          <legend>{copy(language, "focus")}</legend>
          {(
            ["periods", "general", "conception", "pregnancy", "baby"] as const
          ).map((x) => (
            <label className="radioChoice" key={x}>
              <input
                type="radio"
                name="focus"
                checked={focus === x}
                onChange={() => setFocus(x)}
              />
              <span>{copy(language, x)}</span>
            </label>
          ))}
          <EnglishContent>
            <p>
              Pregnancy and baby features currently keep records. Selecting a
              focus creates no health record.
            </p>
          </EnglishContent>
          <button
            className="textbtn"
            onClick={() => {
              setFocus("periods");
              setStep(2);
            }}
          >
            {copy(language, "chooseLater")}
          </button>
        </fieldset>
      )}
      {step === 2 && (
        <>
          <label className="checkChoice">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            {copy(language, "sharedDevice")}
          </label>
          <label className="checkChoice">
            <input
              type="checkbox"
              disabled={shared}
              checked={!shared && retention === "device"}
              onChange={(e) =>
                setRetention(e.target.checked ? "device" : "session")
              }
            />
            {copy(language, "keepConversations")}
          </label>
          <EnglishContent>
            <p>
              New conversations stay in this session unless you choose to keep
              them. Keeping audio is a separate setting.
            </p>
            <p>
              On a shared device, previews are hidden and new conversations and
              drafts stay in memory. An explicit Save still stores a health
              record on this device. This setting does not encrypt or lock
              browser storage.
            </p>
            <details>
              <summary>Optional practice</summary>
              <p>
                Tap Record, speak for up to 60 seconds, then check what we
                heard. Confirm only when the words are correct. You can use
                guided topics instead.
              </p>
            </details>
          </EnglishContent>
        </>
      )}
      {error && (
        <p className="risk urgent" role="alert">
          {error}
        </p>
      )}
      <div className="screenActions">
        {step > 0 && (
          <button className="secondaryBtn" onClick={() => setStep(step - 1)}>
            {copy(language, "back")}
          </button>
        )}
        <button
          className="btn"
          onClick={step === 2 ? finish : () => setStep(step + 1)}
        >
          {copy(language, "continue")}
        </button>
        <Link className="textlink" href="/help">
          {copy(language, "help")}
        </Link>
      </div>
    </section>
  );
}
