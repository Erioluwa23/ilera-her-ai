"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "@/lib/languages";
import { useLanguage } from "@/lib/use-language";
import { useVoiceRecording } from "@/lib/use-voice-recording";
import { useVoicePlayback } from "@/lib/use-voice-playback";
import { contextFor, type VoiceMessage } from "@/lib/voice-chat";
import {
  loadVoiceMessages,
  saveVoiceMessage,
  deleteVoiceConversation,
  deleteVoiceMessage,
} from "@/lib/voice-chat-store";
import {
  sessionMessages,
  keepSessionMessages,
  clearVoiceSessions,
} from "@/lib/voice-session";
import { useOwner, usePreferences } from "@/lib/experience";
import { copy } from "@/lib/ui-copy";
import { possibleDangerReport } from "@/lib/health/danger-report";
import VoiceMessageCard from "./VoiceMessageCard";
import GuidedTopics from "./GuidedTopics";
import ConfirmationDialog from "./ConfirmationDialog";
import EnglishContent from "./EnglishContent";
export default function VoiceLog({
  compact = false,
  initialThread,
}: {
  compact?: boolean;
  initialThread?: string;
}) {
  const owner = useOwner(),
    { prefs, update } = usePreferences(),
    { language, setLanguage } = useLanguage(),
    voice = useVoiceRecording(),
    playback = useVoicePlayback();
  const [messages, setMessages] = useState<VoiceMessage[]>([]),
    [savedIds, setSavedIds] = useState<string[]>([]),
    [savedAudioIds, setSavedAudioIds] = useState<string[]>([]),
    [conversationId, setConversationId] = useState(""),
    [replyTo, setReplyTo] = useState<string>(),
    [loaded, setLoaded] = useState(false),
    [processing, setProcessing] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [seconds, setSeconds] = useState(0),
    [playingId, setPlayingId] = useState<string>(),
    [deletePending, setDeletePending] = useState(false),
    [noticeOpen, setNoticeOpen] = useState(false),
    [showThreads, setShowThreads] = useState(!!initialThread);
  const currentMessages = useRef<VoiceMessage[]>([]),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true),
    active = useRef(false),
    preferences = useRef(prefs),
    composer = useRef<HTMLDivElement>(null);
  const [episode, setEpisode] = useState<"yes" | "no" | "unknown" | "">("");
  useEffect(() => {
    preferences.current = prefs;
  }, [prefs]);
  const busy = voice.busy || processing;
  useEffect(() => {
    mounted.current = true;
    if (!owner) return;
    loadVoiceMessages(owner)
      .then((items) => {
        if (!mounted.current) return;
        const local = sessionMessages(owner),
          merged = [
            ...items.filter((x) => !local.some((m) => m.id === x.id)),
            ...local,
          ].sort((a, b) => a.createdAt - b.createdAt);
        currentMessages.current = merged;
        setMessages(merged);
        setSavedIds(items.map((m) => m.id));
        setSavedAudioIds(items.filter((m) => m.audio).map((m) => m.id));
        setConversationId(
          initialThread &&
            merged.some((m) => m.conversationId === initialThread)
            ? initialThread
            : local.at(-1)?.conversationId || crypto.randomUUID(),
        );
      })
      .catch(() => {
        if (mounted.current) {
          const local = sessionMessages(owner);
          currentMessages.current = local;
          setMessages(local);
          setStorageError(
            "Saved conversations could not be opened. New messages can stay in this session.",
          );
          setConversationId(crypto.randomUUID());
        }
      })
      .finally(() => {
        if (mounted.current) setLoaded(true);
      });
    return () => {
      mounted.current = false;
      controller.current?.abort();
      document
        .querySelectorAll<HTMLAudioElement>(".chatMessage audio")
        .forEach((a) => a.pause());
    };
  }, [owner, initialThread]);
  useEffect(() => {
    if (!voice.recording) return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [voice.recording]);
  const cancelRecording = voice.cancel,
    stopPlayback = playback.stop;
  useEffect(() => {
    const end = () => {
      cancelRecording();
      controller.current?.abort();
      stopPlayback();
      clearVoiceSessions();
      currentMessages.current = [];
      setMessages([]);
    };
    window.addEventListener("ileraher-session-ended", end);
    return () => window.removeEventListener("ileraher-session-ended", end);
  }, [cancelRecording, stopPlayback]);
  async function put(message: VoiceMessage) {
    if (!owner || !mounted.current) return;
    const next = currentMessages.current.some((m) => m.id === message.id)
      ? currentMessages.current.map((m) => (m.id === message.id ? message : m))
      : [...currentMessages.current, message];
    currentMessages.current = next;
    setMessages(next);
    keepSessionMessages(owner, next);
    const p = preferences.current;
    if (p.sharedDevice || p.conversationRetention !== "device") return;
    const retained = {
      ...message,
      ...(!p.keepAudio ? { audio: undefined, filename: undefined } : {}),
    };
    // An unconfirmed audio-only message is retained only after explicit audio retention choice.
    if (!retained.text && !retained.audio) return;
    try {
      const persisted = await saveVoiceMessage(owner, retained);
      if (mounted.current) {
        setSavedIds((ids) => [
          ...ids.filter((id) => id !== message.id),
          message.id,
        ]);
        setSavedAudioIds((ids) =>
          persisted.audio
            ? [...ids.filter((id) => id !== message.id), message.id]
            : ids.filter((id) => id !== message.id),
        );
      }
    } catch (e) {
      if (mounted.current)
        setStorageError(
          e instanceof Error ? e.message : copy(language, "notSaved"),
        );
    }
  }
  async function patch(id: string, changes: Partial<VoiceMessage>) {
    const m = currentMessages.current.find((x) => x.id === id);
    if (m) await put({ ...m, ...changes });
  }
  function stopAudio() {
    playback.stop();
    setPlayingId(undefined);
    document
      .querySelectorAll<HTMLAudioElement>(".chatMessage audio")
      .forEach((a) => a.pause());
  }
  function cancel() {
    voice.cancel();
    controller.current?.abort();
    active.current = false;
    setProcessing(false);
    setStatus("");
    stopAudio();
  }
  async function transcribe(message: VoiceMessage, signal: AbortSignal) {
    if (!message.audio) return;
    setStatus(copy(message.language, "checkingAudio"));
    const form = new FormData();
    form.append("audio", message.audio, message.filename);
    form.append("language", message.language);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.text !== "string" || !data.text.trim())
        throw new Error(
          data.error || "No speech was detected. Record again or retry.",
        );
      if (!signal.aborted)
        await patch(message.id, { text: data.text, error: undefined });
    } catch (e) {
      if (!signal.aborted)
        await patch(message.id, {
          error:
            e instanceof Error
              ? e.message
              : "Transcription unavailable. Your recording remains available in this session.",
        });
    } finally {
      if (!signal.aborted && mounted.current) setStatus("");
    }
  }
  async function record(noticeAccepted = false) {
    if (busy || active.current || !loaded) return;
    if (!navigator.onLine) {
      setError(copy(language, "offline"));
      return;
    }
    if (!prefs.voiceNoticeAccepted && !noticeAccepted) {
      setNoticeOpen(true);
      return;
    }
    stopAudio();
    setError("");
    setSeconds(0);
    const parent = replyTo,
      thread = conversationId;
    await voice.start(language, async (audio, filename, code, signal) => {
      if (!audio.size)
        throw new Error("No audio was recorded. Please try again.");
      const m: VoiceMessage = {
        id: crypto.randomUUID(),
        conversationId: thread,
        role: "user",
        createdAt: Date.now(),
        language: code,
        audio,
        filename,
        replyTo: parent,
      };
      if (!signal.aborted) {
        await put(m);
        await transcribe(m, signal);
      }
    });
  }
  async function task(work: (signal: AbortSignal) => Promise<void>) {
    if (busy || active.current) return;
    active.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setProcessing(true);
    setError("");
    try {
      await work(abort.signal);
    } catch (e) {
      if (!abort.signal.aborted && mounted.current)
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (controller.current === abort) {
        active.current = false;
        if (mounted.current) {
          setProcessing(false);
          setStatus("");
        }
      }
    }
  }
  async function saveReplyAudio(m: VoiceMessage, signal: AbortSignal) {
    if (
      prefs.sharedDevice ||
      prefs.conversationRetention !== "device" ||
      !prefs.keepAudio
    ) {
      setError(
        "Choose device conversation and recording retention in Settings before saving audio.",
      );
      return;
    }
    setStatus("Saving reply audio…");
    const r = await fetch("/api/voice/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `${m.text} ${m.disclaimer || ""}`,
        language: m.language,
      }),
      signal,
    });
    if (!r.ok)
      throw new Error(
        "Audio is unavailable. You can read the answer or use a matching device voice.",
      );
    const audio = await r.blob();
    if (!signal.aborted)
      await patch(m.id, {
        audio,
        filename: `ileraher-reply-${m.id}.${audio.type.includes("mpeg") ? "mp3" : "wav"}`,
        error: undefined,
      });
  }
  async function send(m: VoiceMessage) {
    if (
      !m.text ||
      currentMessages.current.some(
        (x) => x.role === "assistant" && x.replyTo === m.id,
      )
    )
      return;
    if (m.replyTo && !episode) {
      setError(
        "Choose whether the earlier symptoms are happening now before confirming this follow-up.",
      );
      return;
    }
    await task(async (signal) => {
      setStatus(copy(m.language, "preparing"));
      await patch(m.id, { confirmed: true, error: undefined });
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: m.text,
            language: m.language,
            conversation: contextFor(currentMessages.current, m.replyTo),
            currentEpisode: m.replyTo ? episode : "unknown",
            allowExternalAI: preferences.current.externalAI,
          }),
          signal,
        });
        const data = await response.json();
        if (
          !response.ok ||
          typeof data.answer !== "string" ||
          !data.answer.trim()
        )
          throw new Error(
            "Could not get guidance. Check your connection and retry this message.",
          );
        if (signal.aborted || !mounted.current) return;
        const reply: VoiceMessage = {
          id: crypto.randomUUID(),
          conversationId: m.conversationId,
          role: "assistant",
          createdAt: Date.now(),
          language: m.language,
          replyTo: m.id,
          text: data.answer,
          urgency: data.urgency,
          nextSteps: data.nextSteps,
          disclaimer: data.disclaimer,
          sources: data.sources,
          model: data.model,
          generationProvider: data.generationProvider,
        };
        await put(reply);
        setReplyTo(reply.id);
        setEpisode("");
      } catch (e) {
        if (!signal.aborted && mounted.current)
          await patch(m.id, {
            error:
              e instanceof Error
                ? e.message
                : "Guidance unavailable. Retry this message.",
          });
      }
    });
  }
  async function discard(m: VoiceMessage) {
    try {
      if (owner && savedIds.includes(m.id))
        await deleteVoiceMessage(owner, m.id);
      const next = currentMessages.current.filter((x) => x.id !== m.id);
      currentMessages.current = next;
      setMessages(next);
      if (owner) keepSessionMessages(owner, next);
    } catch {
      setError("The recording could not be discarded. Try again.");
    }
  }
  function newConversation() {
    stopAudio();
    setConversationId(crypto.randomUUID());
    setReplyTo(undefined);
    setEpisode("");
    setDeletePending(false);
    setError("");
  }
  const visible = messages.filter((m) => m.conversationId === conversationId),
    threads = [...new Set(messages.map((m) => m.conversationId))].reverse(),
    selected = messages.find((m) => m.id === replyTo),
    unconfirmed = visible.some((m) => m.role === "user" && !m.confirmed);
  return (
    <section
      className={`panel voicepanel voiceScreen voiceChat${compact ? " compactVoice" : ""}`}
    >
      <span className="eyebrow">
        ÌleraHer · {compact ? "Lite" : copy(language, "ask")}
      </span>
      <h1>{copy(language, "ask")}</h1>
      <p className="muted">
        {copy(language, "recordQuestion")} · {copy(language, "heard")} ·{" "}
        {copy(language, "confirmAsk")}
      </p>
      <EnglishContent>
        <p className="chatPrivacy">
          Recordings go to the speech service for transcription before
          confirmation. Confirmed questions use basic guidance; optional
          external AI uses only necessary context.{" "}
          {prefs.sharedDevice || prefs.conversationRetention === "session"
            ? "New conversations stay in this session."
            : prefs.keepAudio
              ? "New text and recordings are kept on this device."
              : "New text is kept on this device; recordings stay in this session."}
        </p>
      </EnglishContent>
      <Link className="textlink" href="/help#care">
        {copy(language, "urgentHelp")}
      </Link>
      <div className="chatToolbar">
        <button
          className="secondaryBtn"
          disabled={busy}
          onClick={newConversation}
        >
          {copy(language, "newConversation")}
        </button>
        <button
          className="textbtn"
          onClick={() => setShowThreads(!showThreads)}
        >
          {copy(language, "savedConversations")}
        </button>
        {visible.length > 0 && (
          <button
            className="textbtn danger"
            disabled={busy}
            onClick={() => setDeletePending(true)}
          >
            {copy(language, "delete")}
          </button>
        )}
      </div>
      {showThreads && (
        <label>
          {copy(language, "conversations")}
          <select
            disabled={busy}
            value={conversationId}
            onChange={(e) => {
              stopAudio();
              setConversationId(e.target.value);
              setReplyTo(undefined);
            }}
          >
            {!threads.includes(conversationId) && (
              <option value={conversationId}>
                {copy(language, "newConversation")}
              </option>
            )}
            {threads.map((id) => (
              <option key={id} value={id}>
                {new Date(
                  messages.find((m) => m.conversationId === id)!.createdAt,
                ).toLocaleString(language)}{" "}
                · {messages.filter((m) => m.conversationId === id).length}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <EnglishContent>
          <fieldset className="choiceGroup">
            <legend>
              Are the symptoms in the earlier messages happening now?
            </legend>
            {(["yes", "no", "unknown"] as const).map((x) => (
              <label className="radioChoice" key={x}>
                <input
                  type="radio"
                  name="current-episode"
                  checked={episode === x}
                  disabled={busy}
                  onChange={() => setEpisode(x)}
                />
                {x === "unknown"
                  ? "Not sure / this is a general question"
                  : x === "yes"
                    ? "Yes, happening now"
                    : "No, this is an older episode"}
              </label>
            ))}
          </fieldset>
        </EnglishContent>
      )}
      {storageError && (
        <p role="alert" className="risk attention">
          {storageError}
        </p>
      )}
      <div
        className="chatTimeline"
        role="region"
        aria-label={copy(language, "conversations")}
      >
        {!loaded ? (
          <p role="status">{copy(language, "loading")}</p>
        ) : (
          visible.map((m) => (
            <div key={m.id}>
              {m.role === "user" &&
                !m.confirmed &&
                m.text &&
                possibleDangerReport(m.text, m.language) && (
                  <EnglishContent>
                    <p className="risk urgent">
                      If these words describe current severe or worrying
                      symptoms, seek in-person medical care now. The recording
                      still needs your confirmation.{" "}
                      <Link href="/help#care">Get help</Link>
                    </p>
                  </EnglishContent>
                )}
              <VoiceMessageCard
                message={m}
                parent={messages.find((x) => x.id === m.replyTo)}
                saved={savedIds.includes(m.id)}
                audioSaved={savedAudioIds.includes(m.id)}
                busy={busy}
                playbackState={playingId === m.id ? playback.state : "idle"}
                onListen={() => {
                  stopAudio();
                  setPlayingId(m.id);
                  playback.play(`${m.text} ${m.disclaimer || ""}`, m.language);
                }}
                onPause={playback.pause}
                onResume={playback.resume}
                onStop={stopAudio}
                onAudioPlay={(element) => {
                  playback.stop();
                  document
                    .querySelectorAll<HTMLAudioElement>(".chatMessage audio")
                    .forEach((a) => {
                      if (a !== element) a.pause();
                    });
                }}
                onFollowUp={() => {
                  stopAudio();
                  setEpisode("");
                  setReplyTo(m.id);
                  setLanguage(m.language);
                  composer.current?.scrollIntoView({ block: "center" });
                }}
                onSend={() => send(m)}
                onRetry={() => task((signal) => transcribe(m, signal))}
                onSaveAudio={() => task((signal) => saveReplyAudio(m, signal))}
              />
              {m.role === "user" && !m.confirmed && (
                <div className="screenActions">
                  <button
                    className="secondaryBtn"
                    disabled={busy}
                    onClick={async () => {
                      await discard(m);
                      await record();
                    }}
                  >
                    {copy(language, "rerecord")}
                  </button>
                  <button
                    className="textbtn"
                    disabled={busy}
                    onClick={() => discard(m)}
                  >
                    {copy(language, "discard")}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div ref={composer} className="voiceComposer">
        {selected && (
          <p className="followUpBanner">
            Following up on this answer ·{" "}
            {new Date(selected.createdAt).toLocaleDateString(language)}
            <button
              className="textbtn"
              disabled={busy}
              onClick={() => setReplyTo(undefined)}
            >
              Ask a new question
            </button>
          </p>
        )}
        <div className="voiceRecordBar">
          <button
            className={voice.recording ? "mic recording" : "mic"}
            disabled={!loaded || (busy && !voice.recording)}
            aria-label={copy(
              language,
              voice.recording ? "stop" : "recordQuestion",
            )}
            onClick={voice.recording ? voice.stop : () => record()}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              {voice.recording ? (
                <rect x="6" y="6" width="12" height="12" fill="currentColor" />
              ) : (
                <>
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
                </>
              )}
            </svg>
          </button>
          <div className="recordBarCopy">
            <strong>
              {copy(
                language,
                voice.recording
                  ? "recording"
                  : voice.busy
                    ? "checkingAudio"
                    : processing
                      ? "preparing"
                      : "recordQuestion",
              )}
            </strong>
            <span>{voice.recording ? seconds + " / 60s" : "60s"}</span>
            {busy && (
              <button className="textbtn" onClick={cancel}>
                {copy(language, voice.recording ? "discard" : "cancel")}
              </button>
            )}
          </div>
          <label className="chatLanguageSelect">
            {copy(language, "language")}
            <select
              disabled={busy || unconfirmed}
              value={language}
              onChange={(e) => {
                stopAudio();
                setLanguage(e.target.value as IlaraLanguage);
              }}
            >
              {LANGUAGE_OPTIONS.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {unconfirmed && (
          <EnglishContent>
            <p>
              To change a recording’s language, discard it and record again in
              the selected language.
            </p>
          </EnglishContent>
        )}
        <p role="status">{status}</p>
        {(voice.error || error || playback.error) && (
          <p role="alert" className="risk attention">
            {voice.error || error || playback.error}
          </p>
        )}
      </div>
      {noticeOpen && (
        <EnglishContent>
          <div className="selectedDay">
            <h2>Before recording</h2>
            <p>
              Your recording is sent to N-ATLAS/NCAIR speech recognition to
              produce a transcript. Check the words before asking. You can use
              tap topics without recording.
            </p>
            <button
              className="btn"
              onClick={() => {
                update({ voiceNoticeAccepted: true });
                setNoticeOpen(false);
                record(true);
              }}
            >
              Send a recording for transcription
            </button>
            <button className="textbtn" onClick={() => setNoticeOpen(false)}>
              Use tap topics
            </button>
          </div>
        </EnglishContent>
      )}
      <GuidedTopics />
      {deletePending && (
        <ConfirmationDialog
          title="Delete this conversation?"
          confirmLabel={copy(language, "delete")}
          busy={busy}
          onClose={() => setDeletePending(false)}
          onConfirm={() =>
            task(async () => {
              if (owner) await deleteVoiceConversation(owner, conversationId);
              const next = currentMessages.current.filter(
                (m) => m.conversationId !== conversationId,
              );
              currentMessages.current = next;
              setMessages(next);
              if (owner) keepSessionMessages(owner, next);
              newConversation();
            })
          }
        >
          <p>
            All recordings, replies and follow-ups in this conversation will be
            removed from this device and session. This is permanent.
          </p>
        </ConfirmationDialog>
      )}
    </section>
  );
}
