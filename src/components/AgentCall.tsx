"use client";
import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useUI, quotaNotice, type UIKey } from "@/lib/ui-language";
import { useAgentCall } from "@/lib/use-agent-call";
import type { CallPhase } from "@/lib/agent-call-client";
import Icon, { Flower } from "./Icon";

const phases: Record<CallPhase, UIKey> = {
  idle: "callReady", connecting: "callConnecting", listening: "callListening", thinking: "callThinking",
  speaking: "callSpeaking", paused: "callPaused", ended: "callEnded", error: "callEnded",
};
export default function AgentCall() {
  const { t, language, setLanguage } = useUI();
  const { call, client } = useAgentCall();
  const [consented, setConsented] = useState(false);
  const error = call.error === "asrQuota" || call.error === "speechQuota"
    ? quotaNotice(call.retryAt, t, call.error) : call.error ? t(call.error) : "";
  return (
    <section className="ux-call-screen">
      <Link className="ux-text-link" href="/help"><Icon name="back" size={18} />{t("back")}</Link>
      <div className="ux-call-panel">
        <span className="ux-badge"><Icon name="wifi" size={16} />{t("callInApp")}</span>
        <h1>{t("phone")}</h1>
        <p className="ux-muted">{t("callInternetHint")}</p>
        <div className={`ux-call-orbit is-${call.phase}`} style={{ "--call-level": call.level } as CSSProperties}>
          <Flower size={100} />
        </div>
        <p className="ux-call-status" role="status" aria-live="polite">{t(phases[call.phase])}</p>
        {call.active ? <p className="ux-call-time" aria-label={t("callInApp")}>{Math.floor(call.elapsed / 60)}:{String(call.elapsed % 60).padStart(2, "0")}</p> : null}
        {!call.active ? (
          <>
            <label className="ux-call-language">{t("language")}
              <select value={language} onChange={e => setLanguage(e.target.value as typeof language)}>
                {LANGUAGE_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <label className="ux-call-consent"><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} />{t("callConsent")}</label>
            <button className="ux-btn ux-call-start" disabled={!consented} onClick={() => void client.start(language)}>
              <Icon name="phone" />{t(call.phase === "idle" ? "callStart" : "callAgain")}
            </button>
          </>
        ) : (
          <div className="ux-call-controls">
            <button className="ux-call-control" disabled={call.phase === "connecting"} aria-pressed={call.muted} onClick={() => client.toggleMute()}>
              <Icon name="mic" />{t(call.muted ? "callUnmute" : "callMute")}
            </button>
            <button className="ux-call-control ux-call-end" onClick={() => client.hangup()}><Icon name="phone" />{t("callEnd")}</button>
          </div>
        )}
        {call.phase === "listening" ? <button className="ux-btn ux-secondary" onClick={() => client.send()}><Icon name="arrow" size={18} />{t("callAnswerNow")}</button> : null}
        {call.pendingAudio ? <button className="ux-btn" onClick={() => void client.playPending()}><Icon name="play" />{t("listenReply")}</button> : null}
        {call.phase === "paused" && !call.pendingAudio ? <button className="ux-btn ux-secondary" onClick={() => client.resumeListening()}><Icon name="mic" />{t("callSpeak")}</button> : null}
        {error ? <p className="ux-call-error" role="alert">{error}</p> : null}
        <p className="ux-muted ux-call-hint">{t("callInstruction")}</p>
        <small>{t("poweredByNatlas")}</small>
      </div>
      {call.reply ? <details className="ux-call-transcript" open={call.phase === "error"}>
        <summary>{t("callConversation")}</summary>
        <p className="ux-call-question">{call.reply.question}</p>
        <p>{call.reply.answer}</p>
        {call.reply.nextSteps.length ? <ul>{call.reply.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul> : null}
        <p className="ux-muted">{call.reply.disclaimer}</p>
        <small>{t(call.reply.model === "curated" ? "phoneReviewed" : "poweredByNatlas")}</small>
        {call.reply.sources.length ? <ul>{call.reply.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul> : null}
      </details> : null}
      <details className="ux-call-privacy"><summary><Icon name="lock" size={16} />{t("privacy")}</summary><p>{t("callPrivacy")}</p><p>{t("healthInfo")}</p><Link href="/settings/phone">{t("phoneSetup")}</Link></details>
    </section>
  );
}
