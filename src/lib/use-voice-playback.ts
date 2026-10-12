"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { IlaraLanguage } from "./languages";
import { requestYarnAudio, YarnAudioError, type SpeechErrorKey } from "./yarn-audio";
export function useVoicePlayback() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle"),
    [error, setError] = useState<SpeechErrorKey | "audioPlaybackError" | "">("");
  const id = useId();
  const active = useRef<HTMLAudioElement | null>(null),
    request = useRef<AbortController | null>(null),
    objectUrl = useRef<string | null>(null),
    cache = useRef<{ key: string; audio: Blob } | null>(null),
    alive = useRef(false);
  const stop = useCallback(() => {
    request.current?.abort();
    request.current = null;
    const audio = active.current;
    active.current = null;
    audio?.pause();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (alive.current) { setState("idle"); setError(""); }
  }, []);
  useEffect(() => {
    alive.current = true;
    const pause = (event: Event) => {
      if ((event as CustomEvent).detail !== `yarn-${id}`) stop();
    };
    window.addEventListener("ileraher-audio-play", pause);
    return () => {
      alive.current = false;
      window.removeEventListener("ileraher-audio-play", pause);
      stop();
      cache.current = null;
    };
  }, [id, stop]);
  async function play(text: string, language: IlaraLanguage) {
    if (request.current) return;
    stop();
    setError("");
    setState("loading");
    const controller = new AbortController();
    request.current = controller;
    window.dispatchEvent(new CustomEvent("ileraher-audio-play", { detail: `yarn-${id}` }));
    try {
      const key = JSON.stringify([text, language]);
      const blob = cache.current?.key === key ? cache.current.audio : await requestYarnAudio(text, language, controller.signal);
      if (controller.signal.aborted || !alive.current) return;
      cache.current = { key, audio: blob };
      objectUrl.current = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl.current);
      active.current = audio;
      audio.onended = () => { if (active.current === audio) setState("idle"); };
      audio.onerror = () => {
        if (active.current === audio) { setState("idle"); setError("voiceUnavailable"); }
      };
      try {
        await audio.play();
        if (active.current === audio && alive.current) setState("playing");
      } catch {
        if (active.current === audio && alive.current) { setState("idle"); setError("audioPlaybackError"); }
      }
    } catch (e) {
      if (!controller.signal.aborted && alive.current) {
        setState("idle");
        setError(e instanceof YarnAudioError ? e.key : "voiceUnavailable");
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  function pause() {
    active.current?.pause();
    setState("paused");
  }
  async function resume() {
    const audio = active.current;
    if (!audio) return;
    try {
      await audio.play();
      if (active.current === audio && alive.current) { setState("playing"); setError(""); }
    } catch {
      if (active.current === audio && alive.current) setError("audioPlaybackError");
    }
  }
  return { state, error, play, pause, resume, stop };
}
