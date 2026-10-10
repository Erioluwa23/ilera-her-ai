"use client";
import { useEffect, useState } from "react";
import { useVoicePlayback } from "@/lib/use-voice-playback";
import { useOnline } from "@/lib/ui-utils";
import type { VoiceMessage } from "@/lib/voice-chat";
import { useUI } from "@/lib/ui-language";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import AudioPlayer from "./AudioPlayer";
import Icon from "./Icon";
import Dialog from "./Dialog";
export default function VoiceMessageCard({
  message,
  parent,
  saved,
  busy,
  onFollowUp,
  onReview,
  onRetry,
  onSaveAudio,
}: {
  message: VoiceMessage;
  parent?: VoiceMessage;
  saved: boolean;
  busy: boolean;
  onFollowUp: () => void;
  onReview: () => void;
  onRetry: () => void;
  onSaveAudio: () => void;
}) {
  const { t, locale } = useUI(),
    [menu, setMenu] = useState(false),
    [sharing, setSharing] = useState(false),
    [notice, setNotice] = useState("");
  const playback = useVoicePlayback(),
    online = useOnline();
  const [deviceAvailable, setDeviceAvailable] = useState(false);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const check = () =>
      setDeviceAvailable(
        window.speechSynthesis
          .getVoices()
          .some(
            (v) =>
              v.lang.toLowerCase().split("-")[0] ===
                message.language.toLowerCase().split("-")[0] &&
              (online || v.localService),
          ),
      );
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [message.language, online]);
  useEffect(() => {
    const stop = (e: Event) => {
      if ((e as CustomEvent).detail !== `device-${message.id}`) playback.stop();
    };
    window.addEventListener("ileraher-audio-play", stop);
    return () => window.removeEventListener("ileraher-audio-play", stop);
  }, [message.id, playback.stop]);
  const stamp = new Date(message.createdAt).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  function file() {
    return message.audio
      ? new File(
          [message.audio],
          message.filename || `ileraher-${message.id}.mp3`,
          { type: message.audio.type },
        )
      : new File(
          [
            `${message.text || ""}\n\n${message.disclaimer || ""}\n${(message.sources || []).map((s) => `${s.title}: ${s.url}`).join("\n")}`,
          ],
          `ileraher-${message.id}.txt`,
          { type: "text/plain" },
        );
  }
  function download() {
    const attachment = file(),
      url = URL.createObjectURL(attachment),
      a = document.createElement("a");
    a.href = url;
    a.download = attachment.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function share() {
    try {
      const attachment = file();
      if (navigator.share && navigator.canShare?.({ files: [attachment] })) {
        await navigator.share({ files: [attachment], title: "ÌleraHer" });
        setSharing(false);
      } else {
        download();
        setNotice(t("download"));
        setSharing(false);
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setNotice(t("saveError"));
    }
  }
  return (
    <article
      className={`ux-message ${message.role}`}
      id={`message-${message.id}`}
    >
      {parent && (
        <a className="ux-reply-reference" href={`#message-${parent.id}`}>
          {t("reply")} · {parent.text?.slice(0, 75) || t("recording")}
        </a>
      )}
      {message.audio && <AudioPlayer audio={message.audio} id={message.id} />}
      {message.text && (message.role === "assistant" || !message.audio) ? (
        <>
          <p>{message.text}</p>
          {message.disclaimer && <small>{message.disclaimer}</small>}
        </>
      ) : message.text ? (
        <details>
          <summary>{t("showTranscript")}</summary>
          <p>{message.text}</p>
        </details>
      ) : null}
      {message.urgency && message.urgency !== "routine" && (
        <div className="ux-alert" role="alert">
          <strong>{t("carePriority")}</strong>
          <p>{message.disclaimer || t("moreCare")}</p>
        </div>
      )}
      {!!message.sources?.length && (
        <details>
          <summary>{t("sources")}</summary>
          <ul>
            {message.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {message.error && (
        <p role="status" className="ux-alert">
          {message.error}
        </p>
      )}
      {message.role === "assistant" && !message.audio && deviceAvailable && (
        <div className="ux-message-actions">
          <button
            className="ux-secondary"
            onClick={() => {
              if (playback.state === "playing") playback.pause();
              else if (playback.state === "paused") playback.resume();
              else {
                window.dispatchEvent(
                  new CustomEvent("ileraher-audio-play", {
                    detail: `device-${message.id}`,
                  }),
                );
                playback.play(
                  `${message.text} ${message.disclaimer || ""}`,
                  message.language,
                );
              }
            }}
          >
            <Icon
              name={playback.state === "playing" ? "pause" : "play"}
              size={16}
            />
            {playback.state === "playing"
              ? t("pause")
              : playback.state === "paused"
                ? t("resume")
                : t("listenReply")}
          </button>
          <small>{t("deviceVoice")}</small>
        </div>
      )}
      {playback.error && (
        <p role="status" className="ux-alert">
          {t("voiceUnavailable")}
        </p>
      )}
      <div className="ux-message-actions">
        {message.role === "user" && !message.confirmed && (
          <button className="ux-secondary" disabled={busy} onClick={onReview}>
            {t("review")}
          </button>
        )}
        {message.role === "user" && message.confirmed && message.error && (
          <button className="ux-secondary" disabled={busy} onClick={onRetry}>
            {t("retry")}
          </button>
        )}
        {(message.role === "assistant" || message.confirmed) && (
          <button className="ux-secondary" disabled={busy} onClick={onFollowUp}>
            <Icon name="reply" size={16} />
            {t("reply")}
          </button>
        )}
        {message.role === "assistant" && !message.audio && (
          <button
            className="ux-secondary"
            disabled={busy}
            onClick={onSaveAudio}
          >
            <Icon name="play" size={16} />
            {t("replyAudio")}
          </button>
        )}
      </div>
      <div className="ux-message-meta">
        <span>
          {LANGUAGE_OPTIONS.find((l) => l.code === message.language)?.label} ·{" "}
          {stamp}
          <br />
          {saved ? t("saved") : t("unsaved")}
        </span>
        <button
          className="ux-icon-button"
          aria-label={t("moreOptions")}
          onClick={() => setMenu(true)}
        >
          <Icon name="more" size={20} />
        </button>
      </div>
      {notice && <small role="status">{notice}</small>}
      {menu && (
        <Dialog title={t("moreOptions")} onClose={() => setMenu(false)}>
          <div className="ux-menu">
            <button
              className="ux-secondary"
              onClick={() => {
                onFollowUp();
                setMenu(false);
              }}
              disabled={busy}
            >
              <Icon name="reply" />
              {t("reply")}
            </button>
            {message.text && (
              <button
                className="ux-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.text!);
                    setNotice(t("copyDone"));
                    setMenu(false);
                  } catch {
                    setNotice(t("saveError"));
                  }
                }}
              >
                <Icon name="copy" />
                {t("copy")}
              </button>
            )}
            <button
              className="ux-secondary"
              onClick={() => {
                download();
                setMenu(false);
              }}
            >
              <Icon name="download" />
              {t("download")}
            </button>
            <button
              className="ux-secondary"
              onClick={() => {
                setMenu(false);
                setSharing(true);
              }}
            >
              <Icon name="share" />
              {t("share")}
            </button>
          </div>
        </Dialog>
      )}
      {sharing && (
        <Dialog title={t("sharePreview")} onClose={() => setSharing(false)}>
          <p>{t("exportWarning")}</p>
          <blockquote>
            {message.text?.slice(0, 400) || t("recording")}
          </blockquote>
          <div className="ux-actions">
            <button className="ux-button" onClick={share}>
              {t("share")}
            </button>
            <button className="ux-secondary" onClick={() => setSharing(false)}>
              {t("cancel")}
            </button>
          </div>
        </Dialog>
      )}
    </article>
  );
}
