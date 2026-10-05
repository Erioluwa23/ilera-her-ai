"use client";
import { useEffect, useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type IlaraLanguage } from "@/lib/languages";
import { useLanguage } from "@/lib/use-language";
import { useVoiceRecording } from "@/lib/use-voice-recording";
import { useVoicePlayback } from "@/lib/use-voice-playback";
type Transcript = { text: string; language: IlaraLanguage };
const PROMPTS: Record<IlaraLanguage, string> = {
  "en-NG": "Speak your symptoms in your language",
  yo: "Sọ ohun tó ń ṣe ọ́ ní èdè rẹ",
  ha: "Yi magana game da alamominki da harshenki",
  ig: "Kwuo mgbaàmà gị n'asụsụ gị",
};
export default function VoiceLog({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage(),
    voice = useVoiceRecording(),
    playback = useVoicePlayback();
  const [transcript, setTranscript] = useState<Transcript | null>(null),
    [answer, setAnswer] = useState(""),
    [urgency, setUrgency] = useState("");
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [answerBusy, setAnswerBusy] = useState(false),
    [seconds, setSeconds] = useState(0),
    [audioUrl, setAudioUrl] = useState("");
  const url = useRef(""),
    answerController = useRef<AbortController | null>(null),
    sending = useRef(false);
  const busy = voice.busy || answerBusy;
  useEffect(() => {
    if (!voice.recording) return;
    const timer = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [voice.recording]);
  useEffect(
    () => () => {
      answerController.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function clearAudio() {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
    setAudioUrl("");
  }
  function cancel() {
    voice.cancel();
    answerController.current?.abort();
    sending.current = false;
    setAnswerBusy(false);
    setStatus("");
    playback.stop();
  }
  async function record() {
    if (busy) return;
    playback.stop();
    clearAudio();
    setTranscript(null);
    setAnswer("");
    setUrgency("");
    setError("");
    setSeconds(0);
    setStatus("");
    await voice.start(language, async (audio, filename, code, signal) => {
      url.current = URL.createObjectURL(audio);
      setAudioUrl(url.current);
      setStatus("Checking what we heard…");
      const form = new FormData();
      form.append("audio", audio, filename);
      form.append("language", code);
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
          signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Could not understand the recording. Try again.",
          );
        if (signal.aborted) return;
        if (typeof data.text !== "string" || !data.text.trim())
          throw new Error("No speech was detected. Please record again.");
        setTranscript({ text: data.text, language: code });
      } finally {
        if (!signal.aborted) setStatus("");
      }
    });
  }
  async function send() {
    if (!transcript || sending.current || voice.busy) return;
    const current = transcript;
    const controller = new AbortController();
    answerController.current = controller;
    sending.current = true;
    setAnswerBusy(true);
    setError("");
    setAnswer("");
    setStatus("Preparing your guidance…");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: current.text,
          language: current.language,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not get guidance. Try sending again.",
        );
      if (controller.signal.aborted) return;
      if (typeof data.answer !== "string" || !data.answer.trim())
        throw new Error("No guidance was returned. Try sending again.");
      setAnswer(data.answer);
      setUrgency(
        ["routine", "attention", "urgent"].includes(data.urgency)
          ? data.urgency
          : "",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Could not get guidance.");
    } finally {
      if (answerController.current === controller) {
        sending.current = false;
        setAnswerBusy(false);
        setStatus("");
      }
    }
  }
  return (
    <section
      className={
        "panel voicepanel voiceScreen" + (compact ? " compactVoice" : "")
      }
    >
      <span className="eyebrow">
        {compact ? "Low-data voice support" : "Ask privately · Voice support"}
      </span>
      <h1>{PROMPTS[language]}</h1>
      <p className="muted">
        Tap to record. Speak naturally, then stop when you finish.
      </p>
      <div className="languagePills" role="group" aria-label="Choose language">
        {LANGUAGE_OPTIONS.map((x) => (
          <button
            key={x.code}
            type="button"
            disabled={busy}
            aria-pressed={language === x.code}
            className={
              language === x.code ? "languageChoice active" : "languageChoice"
            }
            onClick={() => {
              setLanguage(x.code);
              playback.stop();
              setTranscript(null);
              setAnswer("");
              setUrgency("");
              setError("");
              clearAudio();
            }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="voiceStage">
        <span className="pill">
          {voice.recording
            ? "Recording"
            : voice.busy
              ? "Transcribing"
              : answerBusy
                ? "Getting guidance"
                : answer
                  ? "Ready to listen"
                  : transcript
                    ? "Confirm your recording"
                    : "Ready when you are"}
        </span>
        <button
          type="button"
          className={voice.recording ? "mic recording" : "mic"}
          disabled={busy && !voice.recording}
          aria-label={voice.recording ? "Stop recording" : "Start recording"}
          onClick={voice.recording ? voice.stop : record}
        >
          {voice.recording ? "■" : "🎙"}
        </button>
        <strong>
          {voice.recording
            ? "Stop recording"
            : transcript
              ? "Record again"
              : "Tap to speak"}
        </strong>
        {voice.recording && <p role="timer">{seconds}s / 60s</p>}
        <p className="voiceHint">
          Up to 60 seconds · Microphone permission required
        </p>
        {busy && (
          <button className="secondaryBtn" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {(voice.error || error) && (
        <p role="alert" className="risk attention">
          {voice.error || error}
        </p>
      )}
      {audioUrl && (
        <div className="recordingPreview">
          <label htmlFor="recording-audio">Listen to your recording</label>
          <audio id="recording-audio" src={audioUrl} controls preload="none" />
        </div>
      )}
      {transcript && (
        <div className="voiceResult">
          <div className="voiceResultBlock">
            <span>Check what we heard</span>
            <p>{transcript.text}</p>
          </div>
          <p className="small muted">
            Does this match what you said? Confirm, or record again.
          </p>
          <div className="screenActions">
            <button className="btn" disabled={busy} onClick={send}>
              {answer ? "Get guidance again" : "Yes, get guidance →"}
            </button>
            <button className="secondaryBtn" disabled={busy} onClick={record}>
              Record again
            </button>
          </div>
        </div>
      )}
      {answer && transcript && (
        <article className="voiceResult">
          <h2>Your guidance</h2>
          <p>{answer}</p>
          {urgency && (
            <div className={"risk " + urgency}>Care priority: {urgency}</div>
          )}
          <div className="screenActions">
            {playback.state === "idle" ? (
              <button
                className="btn"
                onClick={() => playback.play(answer, transcript.language)}
              >
                ▶ Listen to guidance
              </button>
            ) : (
              <>
                <button
                  className="btn"
                  onClick={
                    playback.state === "paused"
                      ? playback.resume
                      : playback.pause
                  }
                >
                  {playback.state === "paused" ? "▶ Resume" : "Ⅱ Pause"}
                </button>
                <button className="secondaryBtn" onClick={playback.stop}>
                  Stop audio
                </button>
              </>
            )}
          </div>
          {playback.error && (
            <p role="status" className="risk attention">
              {playback.error}
            </p>
          )}
          <p className="small muted">
            Playback depends on voices available on your device. Health
            information supports professional care.
          </p>
        </article>
      )}
      <p className="voiceHint">
        Online connection needed for answers. Audio plays only when you choose.
      </p>
    </section>
  );
}
