"use client";
import { useEffect, useRef, useState } from "react";
import type { IlaraLanguage } from "./languages";

export function recordingFilename(type: string) {
  return type.includes("mp4")
    ? "voice.m4a"
    : type.includes("ogg")
      ? "voice.ogg"
      : type.includes("wav")
        ? "voice.wav"
        : "voice.webm";
}

export function useVoiceRecording() {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const elapsed = useRef(0);
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  function stop() {
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
  }
  async function start(
    language: IlaraLanguage,
    done: (
      audio: Blob,
      filename: string,
      language: IlaraLanguage,
      signal: AbortSignal,
    ) => Promise<void>,
  ) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setPaused(false);
    setSeconds(0);
    setLevels([]);
    elapsed.current = 0;
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (controller.current !== abort) return;
      active.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(
          "Microphone access is unavailable. Check microphone permissions and try again.",
        );
      }
      return;
    }
    if (abort.signal.aborted) {
      media.getTracks().forEach((track) => track.stop());
      if (controller.current === abort) active.current = false;
      return;
    }
    stream.current = media;
    try {
      const r = new MediaRecorder(media);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        abort.abort();
        setError("Audio recording failed. Please record again.");
        stop();
      };
      r.onstop = async () => {
        if (controller.current === abort && timer.current)
          clearTimeout(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (stream.current === media) stream.current = null;
        if (mounted.current && controller.current === abort)
          setRecording(false);
        try {
          if (!abort.signal.aborted)
            await done(
              new Blob(chunks, { type: r.mimeType }),
              recordingFilename(r.mimeType),
              language,
              abort.signal,
            );
        } catch (e) {
          if (mounted.current && !abort.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Voice processing failed.",
            );
        } finally {
          if (controller.current === abort) {
            active.current = false;
            if (mounted.current) setBusy(false);
          }
        }
      };
      r.start();
      setRecording(true);
    } catch {
      media.getTracks().forEach((track) => track.stop());
      active.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(
          "This browser cannot record supported audio. Check microphone permissions and try again.",
        );
      }
    }
  }
  function cancel() {
    controller.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    active.current = false;
    setRecording(false);
    setBusy(false);
    setError("");
  }
  function pause() {
    if (recorder.current?.state === "recording") {
      recorder.current.pause();
      setPaused(true);
    }
  }
  function resume() {
    if (recorder.current?.state === "paused") {
      recorder.current.resume();
      setPaused(false);
    }
  }
  useEffect(() => {
    if (!recording || paused) return;
    let previous = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      elapsed.current += now - previous;
      previous = now;
      setSeconds(Math.min(60, Math.floor(elapsed.current / 1000)));
      if (elapsed.current >= 60000) stop();
    }, 100);
    let context: AudioContext | undefined;
    let frame = 0;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const source = context.createMediaStreamSource(stream.current!);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let sampled = 0;
      const tick = () => {
        if (performance.now() - sampled > 100) {
          analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(
            samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) /
              samples.length,
          );
          setLevels((old) => [...old.slice(-29), Math.min(1, rms * 6)]);
          sampled = performance.now();
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* Recording remains available when live visualisation is unsupported. */
    }
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(frame);
      void context?.close();
    };
  }, [recording, paused]);
  return {
    recording,
    busy,
    error,
    start,
    stop,
    cancel,
    paused,
    pause,
    resume,
    seconds,
    levels,
  };
}

export function speakResponse(text: string, language: IlaraLanguage): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window))
    return false;
  const voice = window.speechSynthesis
    .getVoices()
    .find(
      (v) =>
        v.lang.toLowerCase().split("-")[0] ===
        language.toLowerCase().split("-")[0],
    );
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
  return true;
}
