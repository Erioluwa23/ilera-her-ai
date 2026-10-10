"use client";
import { useEffect, useState } from "react";
import type { VoiceMessage } from "@/lib/voice-chat";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
import { LANGUAGE_OPTIONS } from "@/lib/languages";

export default function VoiceMessageCard({
  message,
  parent,
  saved,
  audioSaved,
  busy,
  playbackState,
  onListen,
  onPause,
  onResume,
  onStop,
  onAudioPlay,
  onFollowUp,
  onSend,
  onRetry,
  onSaveAudio,
}: {
  message: VoiceMessage;
  parent?: VoiceMessage;
  saved: boolean;
  audioSaved: boolean;
  busy: boolean;
  playbackState: "idle" | "playing" | "paused";
  onListen: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onAudioPlay: (element: HTMLAudioElement) => void;
  onFollowUp: () => void;
  onSend: () => void;
  onRetry: () => void;
  onSaveAudio: () => void;
}) {
  const { language: uiLanguage } = useLanguage();
  const [url, setUrl] = useState(""),
    [sharing, setSharing] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!message.audio) return;
    const next = URL.createObjectURL(message.audio);
    queueMicrotask(() => setUrl(next));
    return () => URL.revokeObjectURL(next);
  }, [message.audio]);
  const language = LANGUAGE_OPTIONS.find(
    (x) => x.code === message.language,
  )?.label;
  function file() {
    if (message.audio)
      return new File(
        [message.audio],
        message.filename || `ileraher-${message.id}.mp3`,
        { type: message.audio.type },
      );
    return new File(
      [
        `${message.text || ""}\n\n${message.disclaimer || ""}\n${(message.sources || []).map((s) => `${s.title}: ${s.url}`).join("\n")}`,
      ],
      `ileraher-reply-${message.id}.txt`,
      { type: "text/plain" },
    );
  }
  function download() {
    const next = URL.createObjectURL(file());
    const link = document.createElement("a");
    link.href = next;
    link.download = file().name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(next), 1000);
  }
  async function share() {
    setNotice("");
    const attachment = file();
    try {
      if (navigator.share && navigator.canShare?.({ files: [attachment] })) {
        await navigator.share({
          files: [attachment],
          title: "ÌleraHer voice message",
        });
      } else {
        download();
        setNotice(
          "Downloaded. Attach this file in the app you want to share it with.",
        );
      }
      setSharing(false);
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setNotice("Sharing is unavailable. Use Download instead.");
    }
  }
  return (
    <article
      className={`chatMessage ${message.role}`}
      id={`message-${message.id}`}
    >
      <div className="messageMeta">
        <strong>{message.role === "user" ? "You" : "ÌleraHer"}</strong>
        <span>
          {language} ·{" "}
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {parent && (
        <a className="replyReference" href={`#message-${parent.id}`}>
          ↳ In reply to{" "}
          {parent.role === "user" ? "your recording" : "ÌleraHer’s reply"} at{" "}
          {new Date(parent.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </a>
      )}
      {url ? (
        <audio
          controls
          preload="none"
          src={url}
          aria-label={
            message.role === "user"
              ? "Replay your saved recording"
              : "Replay saved guidance"
          }
          onPlay={(e) => onAudioPlay(e.currentTarget)}
        />
      ) : message.role === "assistant" ? (
        <div className="messagePlayback">
          {playbackState === "idle" ? (
            <button className="btn" onClick={onListen}>
              ▶ Listen to reply
            </button>
          ) : (
            <>
              <button
                className="btn"
                onClick={playbackState === "paused" ? onResume : onPause}
              >
                {playbackState === "paused" ? "▶ Resume" : "Ⅱ Pause"}
              </button>
              <button className="secondaryBtn" onClick={onStop}>
                Stop
              </button>
            </>
          )}
          <span className="small muted">
            Device voice · downloadable audio pending
          </span>
        </div>
      ) : null}
      {message.urgency === "urgent" && (
        <div className="risk urgent" lang={message.language}>
          <strong>{message.nextSteps?.at(-1) || message.disclaimer}</strong>
          <p>
            <a href="/help#care">{copy(uiLanguage, "urgentHelp")}</a>
          </p>
        </div>
      )}
      {message.role === "assistant" && message.text && (
        <div className="answerText" lang={message.language}>
          <span className="pill">
            {message.model === "curated"
              ? copy(uiLanguage, "basicGuidance")
              : "ÌleraHer"}
          </span>
          <p>{message.text}</p>
          {!!message.nextSteps?.length && (
            <ul>
              {message.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          )}
          {message.disclaimer && (
            <p className="small muted">{message.disclaimer}</p>
          )}
        </div>
      )}
      {message.role === "user" && message.text && (
        <div className="messageTranscript" lang={message.language}>
          <strong>{copy(uiLanguage, "heard")}</strong>
          <p>{message.text}</p>
        </div>
      )}
      {message.role === "assistant" && (
        <details className="messageTranscript">
          <summary>{copy(uiLanguage, "sources")}</summary>
          <p>
            {new Date(message.createdAt).toLocaleString(uiLanguage)} ·
            Historical answer based on the confirmed question at that time.
          </p>
          {!!message.sources?.length && (
            <ul>
              {message.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p>
            Source-based guidance: existing content. Clinical and
            native-language re-review pending. Generation:{" "}
            {message.generationProvider || message.model || "unknown"}.
          </p>
        </details>
      )}
      {message.error && (
        <p
          className={message.role === "user" ? "risk attention" : "small muted"}
          role="status"
        >
          {message.error}
        </p>
      )}
      <div className="messageActions">
        {message.role === "user" &&
          message.text &&
          (!message.confirmed || message.error) && (
            <button className="btn" disabled={busy} onClick={onSend}>
              {message.confirmed
                ? "Retry guidance"
                : copy(uiLanguage, "confirmAsk")}
            </button>
          )}
        {message.role === "user" && !message.text && (
          <button className="secondaryBtn" disabled={busy} onClick={onRetry}>
            Retry transcription
          </button>
        )}
        {(message.role === "assistant" || message.confirmed) && (
          <button className="secondaryBtn" disabled={busy} onClick={onFollowUp}>
            ↳ Voice follow-up
          </button>
        )}
        {message.role === "assistant" && !message.audio && (
          <button className="textbtn" disabled={busy} onClick={onSaveAudio}>
            Save reply audio
          </button>
        )}
        <button className="textbtn" onClick={() => setSharing(!sharing)}>
          Share
        </button>
        <button
          className="textbtn"
          onClick={download}
          aria-label={message.audio ? "Download audio" : "Download reply"}
        >
          Download
        </button>
      </div>
      {sharing && (
        <div className="shareNotice">
          <p>
            This shares this message outside ÌleraHer. It may contain private
            health information.
          </p>
          <button className="secondaryBtn" onClick={share}>
            Share this message
          </button>
          <button className="textbtn" onClick={() => setSharing(false)}>
            Cancel
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="small">
          {notice}
        </p>
      )}
      <span className="messageSaved">
        {saved
          ? audioSaved
            ? "Text and recording saved on this device"
            : message.audio
              ? "Text saved on this device · recording stays in this session"
              : copy(uiLanguage, "onDevice")
          : "Session only · keep this tab open"}
      </span>
      {message.role === "assistant" && (
        <p className="small muted" lang="en-NG">
          Answered on{" "}
          {new Date(message.createdAt).toLocaleDateString(message.language)} for
          these messages. This reply is kept as history; new or changed symptoms
          need a new question.
        </p>
      )}
    </article>
  );
}
