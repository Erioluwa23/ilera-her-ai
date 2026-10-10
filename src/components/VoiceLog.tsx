"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "@/lib/languages";
import { useUI } from "@/lib/ui-language";
import { useOnline } from "@/lib/ui-utils";
import { useVoiceRecording } from "@/lib/use-voice-recording";
import { contextFor, type VoiceMessage } from "@/lib/voice-chat";
import {
  loadVoiceMessages,
  saveVoiceMessage,
  deleteVoiceConversation,
  deleteVoiceMessage,
} from "@/lib/voice-chat-store";
import VoiceMessageCard from "./VoiceMessageCard";
import AudioPlayer from "./AudioPlayer";
import Dialog from "./Dialog";
import Icon, { Flower } from "./Icon";
const TYPED = "ileraher-text-draft-v1:";
const ACTIVE = "ileraher-active-conversation-v1",
  CONSENT = "ileraher-voice-consent-v2",
  NAMES = "ileraher-conversation-names-v1";
export default function VoiceLog({ compact = false }: { compact?: boolean }) {
  const { t, language, setLanguage, locale } = useUI(),
    online = useOnline(),
    voice = useVoiceRecording();
  const [messages, setMessages] = useState<VoiceMessage[]>([]),
    [saved, setSaved] = useState<string[]>([]),
    [thread, setThread] = useState(""),
    [loaded, setLoaded] = useState(false),
    [parent, setParent] = useState<string>(),
    [processing, setProcessing] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState("");
  const [draftId, setDraftId] = useState<string>(),
    [words, setWords] = useState(""),
    [disclosure, setDisclosure] = useState(false),
    [typing, setTyping] = useState(false),
    [typed, setTyped] = useState(""),
    [history, setHistory] = useState(false),
    [search, setSearch] = useState(""),
    [deleteId, setDeleteId] = useState<string>(),
    [renameId, setRenameId] = useState<string>(),
    [newName, setNewName] = useState(""),
    [names, setNames] = useState<Record<string, string>>({}),
    [newReply, setNewReply] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const items = useRef<VoiceMessage[]>([]),
    alive = useRef(true),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null),
    timeline = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const busy = processing || voice.busy,
    draft = messages.find((m) => m.id === draftId);
  useEffect(() => {
    alive.current = true;
    loadVoiceMessages()
      .then((data) => {
        if (!alive.current) return;
        items.current = data;
        setMessages(data);
        setSaved(data.map((m) => m.id));
        let last: string | null = null;
        try {
          last = localStorage.getItem(ACTIVE);
          setNames(JSON.parse(localStorage.getItem(NAMES) || "{}"));
        } catch {}
        const chosen =
          last || data.at(-1)?.conversationId || crypto.randomUUID();
        setThread(chosen);
        const unsent = data.filter((m) => m.draft && !m.confirmed).at(-1);
        if (unsent) {
          setThread(unsent.conversationId);
          setDraftId(unsent.id);
          setWords(unsent.text || "");
        } else {
          try {
            const cached = JSON.parse(
              localStorage.getItem(TYPED + chosen) || "null",
            );
            if (
              cached &&
              typeof cached.text === "string" &&
              cached.text.trim()
            ) {
              setTyped(cached.text);
              setParent(cached.parent);
              setTyping(true);
            }
          } catch {}
        }
      })
      .catch(() => {
        if (alive.current) {
          setStorageError(t("storageUnavailable"));
          setThread(crypto.randomUUID());
        }
      })
      .finally(() => {
        if (alive.current) setLoaded(true);
      });
    if (new URLSearchParams(location.search).has("history")) setHistory(true);
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (thread)
      try {
        localStorage.setItem(ACTIVE, thread);
      } catch {}
  }, [thread]);
  useEffect(() => {
    if (nearBottom.current) {
      timeline.current?.scrollTo({ top: timeline.current.scrollHeight });
    } else setNewReply(true);
  }, [messages, thread]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const baseline = window.innerHeight;
    if (!viewport) return;
    const update = () => {
      const focused = document.activeElement;
      const textFocused =
        focused?.tagName === "TEXTAREA" ||
        (focused?.tagName === "INPUT" &&
          ["text", "search", "tel", "email", "password", "number"].includes(
            (focused as HTMLInputElement).type,
          ));
      const keyboard =
        textFocused &&
        Math.max(baseline, window.innerHeight) - viewport.height > 160;
      const root = document.querySelector(".ux-app");
      root?.classList.toggle("ux-keyboard", keyboard);
      (root as HTMLElement)?.style.setProperty(
        "--keyboard-height",
        `${viewport.height}px`,
      );
    };
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.querySelector(".ux-app")?.classList.remove("ux-keyboard");
    };
  }, []);
  async function put(message: VoiceMessage) {
    const next = items.current.some((m) => m.id === message.id)
      ? items.current.map((m) => (m.id === message.id ? message : m))
      : [...items.current, message];
    items.current = next;
    if (alive.current) {
      setMessages(next);
      setSaved((ids) => ids.filter((id) => id !== message.id));
    }
    try {
      const write = writes.current.then(() => saveVoiceMessage(message));
      writes.current = write.catch(() => {});
      await write;
      if (
        alive.current &&
        items.current.find((m) => m.id === message.id) === message
      )
        setSaved((ids) => [
          ...ids.filter((id) => id !== message.id),
          message.id,
        ]);
      return true;
    } catch (e) {
      if (alive.current)
        setStorageError(e instanceof Error ? e.message : t("saveError"));
      return false;
    }
  }
  async function patch(id: string, changes: Partial<VoiceMessage>) {
    const message = items.current.find((m) => m.id === id);
    if (message) return put({ ...message, ...changes });
  }
  function stopAudio() {
    window.dispatchEvent(
      new CustomEvent("ileraher-audio-play", { detail: "stop-all" }),
    );
    document
      .querySelectorAll<HTMLAudioElement>(".ux-chat audio")
      .forEach((a) => a.pause());
    window.speechSynthesis?.cancel();
  }
  async function task(work: (signal: AbortSignal) => Promise<void>) {
    if (lock.current || busy) return;
    if (!online) {
      setError(t("offlineHint"));
      return;
    }
    lock.current = true;
    const controller = new AbortController();
    abort.current = controller;
    setProcessing(true);
    setError("");
    try {
      await work(controller.signal);
    } catch (e) {
      if (alive.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : t("retry"));
    } finally {
      if (abort.current === controller) {
        lock.current = false;
        if (alive.current) {
          setProcessing(false);
          setStatus("");
        }
      }
    }
  }
  function openDraft(m: VoiceMessage) {
    setDraftId(m.id);
    setWords(m.text || "");
    setError("");
  }
  async function record() {
    if (busy || !loaded) return;
    stopAudio();
    setError("");
    const conversationId = thread,
      replyTo = parent;
    await voice.start(language, async (audio, filename, code) => {
      if (!audio.size) throw new Error(t("noSpeech"));
      const message: VoiceMessage = {
        id: crypto.randomUUID(),
        conversationId,
        replyTo,
        role: "user",
        createdAt: Date.now(),
        language: code,
        audio,
        filename,
        draft: true,
      };
      await put(message);
      if (alive.current) openDraft(message);
    });
  }
  function beginRecord() {
    let allowed = false;
    try {
      allowed = localStorage.getItem(CONSENT) === "yes";
    } catch {}
    if (allowed) void record();
    else setDisclosure(true);
  }
  async function transcribe(message: VoiceMessage) {
    if (!message.audio) return;
    await task(async (signal) => {
      setStatus(t("transcribing"));
      const form = new FormData();
      form.append("audio", message.audio!, message.filename);
      form.append("language", message.language);
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
          signal,
        });
        const data = await response.json();
        if (!response.ok || !data.text?.trim())
          throw new Error(data.error || t("noSpeech"));
        await patch(message.id, { text: data.text, error: undefined });
        if (alive.current && !signal.aborted) setWords(data.text);
      } catch (e) {
        if (!signal.aborted) {
          const text = e instanceof Error ? e.message : t("retry");
          await patch(message.id, { error: text });
          setError(text);
        }
      }
    });
  }
  async function send(message: VoiceMessage, text = message.text || "") {
    if (!text.trim() || text.trim().length > 1200) return;
    await task(async (signal) => {
      setStatus(t("sending"));
      await patch(message.id, {
        text: text.trim(),
        confirmed: true,
        draft: false,
        error: undefined,
      });
      setDraftId(undefined);
      setTyping(false);
      setTyped("");
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: text.trim(),
            language: message.language,
            conversation: contextFor(items.current, message.replyTo),
          }),
          signal,
        });
        const data = await response.json();
        if (!response.ok || !data.answer?.trim())
          throw new Error(data.error || t("noReply"));
        if (signal.aborted) return;
        const reply: VoiceMessage = {
          id: crypto.randomUUID(),
          conversationId: message.conversationId,
          replyTo: message.id,
          role: "assistant",
          createdAt: Date.now(),
          language: message.language,
          text: data.answer,
          urgency: data.urgency,
          disclaimer: data.disclaimer,
          sources: data.sources,
          model: data.model,
        };
        await put(reply);
        if (alive.current) setParent(reply.id);
      } catch (e) {
        await patch(message.id, {
          error: signal.aborted
            ? t("retry")
            : e instanceof Error
              ? e.message
              : t("noReply"),
        });
      }
    });
  }
  async function replyAudio(message: VoiceMessage) {
    await task(async (signal) => {
      setStatus(t("processingVoice"));
      try {
        const response = await fetch("/api/voice/audio", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `${message.text} ${message.disclaimer || ""}`,
            language: message.language,
          }),
          signal,
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || t("noReply"));
        }
        const audio = await response.blob();
        if (!signal.aborted)
          await patch(message.id, {
            audio,
            filename: `ileraher-${message.id}.${audio.type.includes("mpeg") ? "mp3" : "wav"}`,
            error: undefined,
          });
      } catch (e) {
        if (!signal.aborted)
          await patch(message.id, {
            error: e instanceof Error ? e.message : t("noReply"),
          });
      }
    });
  }
  async function typedReview() {
    if (!typed.trim()) return;
    const message: VoiceMessage = {
      id: crypto.randomUUID(),
      conversationId: thread,
      replyTo: parent,
      role: "user",
      createdAt: Date.now(),
      language,
      text: typed.trim(),
      draft: true,
    };
    const stored = await put(message);
    openDraft(message);
    setTyping(false);
    setTyped("");
    if (stored)
      try {
        localStorage.removeItem(TYPED + thread);
      } catch {}
  }
  async function discard() {
    if (!draft || busy) return;
    try {
      if (saved.includes(draft.id)) await deleteVoiceMessage(draft.id);
      items.current = items.current.filter((m) => m.id !== draft.id);
      setMessages(items.current);
      setDraftId(undefined);
      setWords("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    }
  }
  function updateTyped(text: string) {
    setTyped(text);
    try {
      localStorage.setItem(
        TYPED + thread,
        JSON.stringify({ text, parent, language }),
      );
    } catch {
      setStorageError(t("saveError"));
    }
  }
  function switchThread(id: string) {
    stopAudio();
    setTyping(false);
    setTyped("");
    setThread(id);
    setParent(undefined);
    setHistory(false);
    nearBottom.current = true;
    setNewReply(false);
  }
  async function remove() {
    if (!deleteId) return;
    try {
      await deleteVoiceConversation(deleteId);
      items.current = items.current.filter(
        (m) => m.conversationId !== deleteId,
      );
      setMessages(items.current);
      if (thread === deleteId)
        switchThread(
          items.current.at(-1)?.conversationId || crypto.randomUUID(),
        );
      setDeleteId(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    }
  }
  const visible = messages.filter(
      (m) => m.conversationId === thread && !m.draft,
    ),
    threads = [...new Set(messages.map((m) => m.conversationId))].reverse(),
    selected = messages.find((m) => m.id === parent);
  function title(id: string) {
    return (
      names[id] ||
      messages
        .find((m) => m.conversationId === id && m.text)
        ?.text?.slice(0, 64) ||
      t("shortVoice")
    );
  }
  return (
    <section className={`ux-chat${compact ? " compact" : ""}`}>
      <header className="ux-chat-header">
        <button
          className="ux-icon-button"
          aria-label={t("conversations")}
          disabled={busy}
          onClick={() => setHistory(true)}
        >
          <Icon name="logs" />
        </button>
        <Flower size={38} />
        <div className="ux-chat-title">
          <strong>ÌleraHer</strong>
          <small>{compact ? t("lowData") : t("aiGuide")}</small>
        </div>
        <label className="ux-chat-language">
          <span className="sr-only">{t("chooseLanguage")}</span>
          <select
            aria-label={t("chooseLanguage")}
            value={language}
            disabled={busy}
            onChange={(e) => setLanguage(e.target.value as IlaraLanguage)}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code === "en-NG" ? "English" : l.label}
              </option>
            ))}
          </select>
        </label>
        <Link
          className="ux-icon-button"
          href="/settings/privacy"
          aria-label={t("space")}
        >
          <Icon name="more" />
        </Link>
      </header>
      {!online && (
        <div className="ux-chat-offline" role="status">
          <Icon name="wifi" size={16} /> {t("offline")} · {t("offlineHint")}
        </div>
      )}
      {storageError && (
        <div className="ux-chat-offline" role="alert">
          {storageError}
        </div>
      )}
      <div
        className="ux-chat-thread"
        ref={timeline}
        aria-label={t("chat")}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          if (nearBottom.current) setNewReply(false);
        }}
      >
        {!loaded ? (
          <p role="status">{t("loading")}</p>
        ) : !visible.length ? (
          <div className="ux-empty-state">
            <Flower size={72} />
            <h2>{t("greeting")}</h2>
            <p>{t("wellbeing")}</p>
            <span className="ux-badge">{t("historyDevice")}</span>
          </div>
        ) : (
          visible.map((message) => (
            <VoiceMessageCard
              key={message.id}
              message={message}
              parent={messages.find((m) => m.id === message.replyTo)}
              saved={saved.includes(message.id)}
              busy={busy}
              onFollowUp={() => {
                setParent(message.id);
                setLanguage(message.language);
                stopAudio();
              }}
              onReview={() => openDraft(message)}
              onRetry={() => send(message)}
              onSaveAudio={() => replyAudio(message)}
            />
          ))
        )}
      </div>
      {newReply && (
        <button
          className="ux-pill ux-new-reply"
          onClick={() => {
            timeline.current?.scrollTo({ top: timeline.current.scrollHeight });
            setNewReply(false);
          }}
        >
          {t("newReply")} ↓
        </button>
      )}
      <div className="ux-composer">
        {selected && (
          <div className="ux-follow-banner">
            <span>
              {t("reply")} · {selected.text?.slice(0, 65) || t("recording")}
            </span>
            <button
              className="ux-icon-button"
              aria-label={t("cancelReply")}
              disabled={busy}
              onClick={() => setParent(undefined)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {voice.recording ? (
          <div className="ux-record-state">
            <strong>
              {voice.paused ? t("paused") : t("recording")} · {voice.seconds}s /
              60s
            </strong>
            <div className="ux-live-wave" aria-hidden="true">
              {voice.levels.map((n, i) => (
                <i key={i} style={{ height: Math.max(2, n * 52) }} />
              ))}
            </div>
            <div className="ux-actions">
              <button
                className="ux-secondary"
                onClick={voice.paused ? voice.resume : voice.pause}
              >
                <Icon name={voice.paused ? "play" : "pause"} />
                {voice.paused ? t("resume") : t("pause")}
              </button>
              <button className="ux-button" onClick={voice.stop}>
                <Icon name="stop" />
                {t("review")}
              </button>
              <button
                className="ux-icon-button"
                aria-label={t("discard")}
                onClick={voice.cancel}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ) : typing ? (
          <>
            <textarea
              rows={2}
              maxLength={1200}
              value={typed}
              aria-label={t("message")}
              onChange={(e) => updateTyped(e.target.value)}
            />
            <div className="ux-actions">
              <button
                className="ux-button"
                disabled={!typed.trim() || busy}
                onClick={typedReview}
              >
                {t("review")}
              </button>
              <button className="ux-secondary" onClick={() => setTyping(false)}>
                {t("cancel")}
              </button>
            </div>
          </>
        ) : (
          <div className="ux-composer-row">
            <button
              className="ux-icon-button"
              aria-label={t("newConversation")}
              disabled={busy}
              onClick={() => switchThread(crypto.randomUUID())}
            >
              <Icon name="plus" />
            </button>
            <div className="ux-composer-copy">
              <strong>{processing ? t("sending") : t("letsTalk")}</strong>
              <small>{t("upTo60")}</small>
            </div>
            <button
              className="ux-icon-button"
              aria-label={t("typeInstead")}
              disabled={busy}
              onClick={() => {
                try {
                  const cached = JSON.parse(
                    localStorage.getItem(TYPED + thread) || "null",
                  );
                  if (cached?.text) setTyped(cached.text);
                } catch {}
                setTyping(true);
              }}
            >
              <Icon name="edit" size={20} />
            </button>
            <button
              className="ux-record-button"
              aria-label={t("record")}
              disabled={busy || !loaded}
              onClick={beginRecord}
            >
              <Icon name="mic" />
            </button>
          </div>
        )}
        {messages.some((m) => m.conversationId === thread && m.draft) &&
          !draft && (
            <button
              className="ux-pill"
              onClick={() =>
                openDraft(
                  messages
                    .filter((m) => m.conversationId === thread && m.draft)
                    .at(-1)!,
                )
              }
            >
              {t("review")} · {t("unsentDraft")}
            </button>
          )}
        {status && (
          <p className="ux-chat-notice" role="status">
            {status}
          </p>
        )}
        {processing && (
          <button className="ux-pill" onClick={() => abort.current?.abort()}>
            {t("cancel")}
          </button>
        )}
        {(error || voice.error) && (
          <p className="ux-alert" role="alert">
            {error || t("recordingUnavailable")}
          </p>
        )}
        <p className="ux-chat-notice">
          {t("aiGuide")} · <Link href="/settings/privacy">{t("privacy")}</Link>
        </p>
      </div>
      {disclosure && (
        <Dialog title={t("beforeListen")} onClose={() => setDisclosure(false)}>
          <p>{t("voiceDisclosure")}</p>
          <p>{t("processingDisclosure")}</p>
          <p>{t("localDisclosure")}</p>
          <div className="ux-actions">
            <button
              className="ux-button"
              onClick={() => {
                try {
                  localStorage.setItem(CONSENT, "yes");
                } catch {}
                setDisclosure(false);
                void record();
              }}
            >
              {t("continueRecord")}
            </button>
            <button
              className="ux-secondary"
              onClick={() => setDisclosure(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </Dialog>
      )}
      {draft && (
        <Dialog
          title={t("yourWords")}
          busy={processing}
          onClose={() => {
            setDraftId(undefined);
            setError("");
          }}
        >
          {draft.audio && (
            <div className="ux-review-audio">
              <AudioPlayer audio={draft.audio} id={`review-${draft.id}`} />
            </div>
          )}
          <p>{t("reviewHint")}</p>
          {draft.audio && !words && (
            <button
              className="ux-secondary"
              disabled={processing || !online}
              onClick={() => transcribe(draft)}
            >
              {processing ? t("transcribing") : t("transcribe")}
            </button>
          )}
          <label htmlFor="review-words">{t("editWords")}</label>
          <textarea
            id="review-words"
            rows={4}
            maxLength={1200}
            value={words}
            onChange={(e) => {
              setWords(e.target.value);
              void patch(draft.id, { text: e.target.value });
            }}
          />
          <small className="ux-review-limit">
            {words.trim().length} / 1,200
          </small>
          {words.trim().length > 1200 && (
            <p className="ux-alert">{t("messageLimit")}</p>
          )}
          <p>{t("textDisclosure")}</p>
          {(error || draft.error) && (
            <p className="ux-alert" role="alert">
              {error || draft.error}
            </p>
          )}
          <small role="status">
            {saved.includes(draft.id) ? t("draftSaved") : t("unsaved")}
          </small>
          {processing && (
            <button className="ux-pill" onClick={() => abort.current?.abort()}>
              {t("cancel")}
            </button>
          )}
          <div className="ux-actions">
            <button
              className="ux-button"
              disabled={
                processing ||
                !online ||
                !words.trim() ||
                words.trim().length > 1200
              }
              onClick={() => send(draft, words)}
            >
              {processing ? t("sending") : t("send")}
            </button>
            <button
              className="ux-secondary"
              disabled={processing}
              onClick={async () => {
                await patch(draft.id, { text: words });
                setDraftId(undefined);
              }}
            >
              {t("saveDraft")}
            </button>
            <button
              className="ux-icon-button"
              disabled={processing}
              aria-label={t("discard")}
              onClick={discard}
            >
              <Icon name="trash" />
            </button>
          </div>
        </Dialog>
      )}
      {history && (
        <Dialog title={t("conversations")} onClose={() => setHistory(false)}>
          <button
            className="ux-button"
            onClick={() => switchThread(crypto.randomUUID())}
          >
            <Icon name="plus" />
            {t("newConversation")}
          </button>
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 20 }}
          />
          <div className="ux-history-list">
            {threads
              .filter((id) =>
                title(id).toLowerCase().includes(search.toLowerCase()),
              )
              .map((id) => (
                <div key={id}>
                  <button onClick={() => switchThread(id)}>
                    <strong>{title(id)}</strong>
                    <small>
                      {new Date(
                        messages.find(
                          (m) => m.conversationId === id,
                        )!.createdAt,
                      ).toLocaleDateString(locale)}
                    </small>
                  </button>
                  <button
                    className="ux-icon-button"
                    aria-label={t("rename")}
                    onClick={() => {
                      setRenameId(id);
                      setNewName(names[id] || "");
                      setHistory(false);
                    }}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    className="ux-icon-button"
                    aria-label={t("delete")}
                    onClick={() => {
                      setDeleteId(id);
                      setHistory(false);
                    }}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            {!threads.length && <p>{t("noConversations")}</p>}
          </div>
        </Dialog>
      )}
      {deleteId && (
        <Dialog title={t("deleteChats")} onClose={() => setDeleteId(undefined)}>
          <p>{t("deleteConfirm")}</p>
          <div className="ux-actions">
            <button className="ux-danger" onClick={remove}>
              {t("delete")}
            </button>
            <button
              className="ux-secondary"
              onClick={() => setDeleteId(undefined)}
            >
              {t("cancel")}
            </button>
          </div>
        </Dialog>
      )}
      {renameId && (
        <Dialog title={t("rename")} onClose={() => setRenameId(undefined)}>
          <input
            aria-label={t("rename")}
            value={newName}
            maxLength={80}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="ux-actions">
            <button
              className="ux-button"
              onClick={() => {
                try {
                  const next = { ...names, [renameId]: newName.trim() };
                  localStorage.setItem(NAMES, JSON.stringify(next));
                  setNames(next);
                  setRenameId(undefined);
                } catch {
                  setError(t("saveError"));
                }
              }}
            >
              {t("save")}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
