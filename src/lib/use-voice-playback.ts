"use client";
import { useEffect, useRef, useState } from "react";
import type { IlaraLanguage } from "./languages";
export function useVoicePlayback() {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle"),
    [error, setError] = useState("");
  const active = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(
    () => () => {
      active.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  function stop() {
    active.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }
  function play(text: string, language: IlaraLanguage) {
    stop();
    setError("");
    if (!("speechSynthesis" in window)) {
      setError("Audio playback is not supported by this browser.");
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find(
        (x) =>
          x.lang.toLowerCase().split("-")[0] ===
          language.toLowerCase().split("-")[0],
      );
    if (!voice) {
      setError(
        "This device has no playback voice for the selected language. The response is shown below.",
      );
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    active.current = utterance;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.95;
    utterance.onstart = () => {
      if (active.current === utterance) setState("playing");
    };
    utterance.onend = () => {
      if (active.current === utterance) {
        active.current = null;
        setState("idle");
      }
    };
    utterance.onerror = () => {
      if (active.current === utterance) {
        active.current = null;
        setState("idle");
        setError("Audio playback failed. Try listening again.");
      }
    };
    window.speechSynthesis.speak(utterance);
  }
  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }
  function resume() {
    window.speechSynthesis.resume();
    setState("playing");
  }
  return { state, error, play, pause, resume, stop };
}
