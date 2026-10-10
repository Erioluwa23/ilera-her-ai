"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useUI } from "@/lib/ui-language";
const format = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export default function AudioPlayer({
  audio,
  id,
}: {
  audio: Blob;
  id: string;
}) {
  const { t } = useUI(),
    element = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState(""),
    [playing, setPlaying] = useState(false),
    [duration, setDuration] = useState(0),
    [time, setTime] = useState(0),
    [speed, setSpeed] = useState(1),
    [wave, setWave] = useState<number[]>([]),
    [error, setError] = useState(false);
  useEffect(() => {
    const next = URL.createObjectURL(audio);
    setUrl(next);
    setTime(0);
    setDuration(0);
    setError(false);
    let alive = true;
    let ctx: AudioContext | undefined;
    void (async () => {
      try {
        ctx = new AudioContext();
        const buffer = await ctx.decodeAudioData(await audio.arrayBuffer());
        if (!alive) return;
        setDuration(buffer.duration);
        const data = buffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / 36));
        const peaks = Array.from({ length: 36 }, (_, i) => {
          let peak = 0;
          for (
            let j = i * step;
            j < Math.min(data.length, (i + 1) * step);
            j += Math.max(1, Math.floor(step / 250))
          )
            peak = Math.max(peak, Math.abs(data[j]));
          return peak;
        });
        const max = Math.max(...peaks, 0.01);
        setWave(peaks.map((p) => p / max));
      } catch {
        /* A seek track remains usable for unsupported decoding. */
      } finally {
        void ctx?.close();
      }
    })();
    return () => {
      alive = false;
      URL.revokeObjectURL(next);
    };
  }, [audio]);
  useEffect(() => {
    const pause = (e: Event) => {
      if ((e as CustomEvent).detail !== id) element.current?.pause();
    };
    window.addEventListener("ileraher-audio-play", pause);
    return () => window.removeEventListener("ileraher-audio-play", pause);
  }, [id]);
  async function toggle() {
    const el = element.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ileraher-audio-play", { detail: id }),
    );
    try {
      el.playbackRate = speed;
      await el.play();
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <div>
      <div className="ux-audio">
        <audio
          ref={element}
          src={url || undefined}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration))
              setDuration(e.currentTarget.duration);
          }}
        />
        <button
          className="ux-audio-play"
          aria-label={playing ? t("pause") : t("play")}
          onClick={toggle}
        >
          <Icon name={playing ? "pause" : "play"} size={20} />
        </button>
        <div className="ux-audio-track">
          <div className="ux-audio-wave" aria-hidden="true">
            {wave.length ? (
              wave.map((n, i) => (
                <i
                  key={i}
                  style={{
                    height: Math.max(2, n * 26),
                    opacity: duration && i / 36 <= time / duration ? 1 : 0.35,
                  }}
                />
              ))
            ) : (
              <div
                style={{ width: "100%", height: 2, background: "currentColor" }}
              />
            )}
          </div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step=".1"
            value={Math.min(time, duration)}
            disabled={!duration}
            aria-label={t("seek")}
            onChange={(e) => {
              if (element.current) {
                element.current.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }
            }}
          />
          <span className="ux-audio-time">
            {format(time)} / {format(duration)}
          </span>
        </div>
        <button
          className="ux-audio-speed"
          aria-label={`${t("speed")} ${speed}×`}
          onClick={() => {
            const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
            setSpeed(next);
            if (element.current) element.current.playbackRate = next;
          }}
        >
          {speed}×
        </button>
      </div>
      {error && (
        <small role="alert">
          {t("retry")} · {t("download")}
        </small>
      )}
    </div>
  );
}
