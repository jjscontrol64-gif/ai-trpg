"use client";

import { useEffect, useRef, useState } from "react";

const BGM_SRC = "/sfx/Beneath_The_Flagstones.mp3";
const BGM_VOLUME = 0.34;

interface BgmToggleProps {
  className?: string;
}

export default function BgmToggle({ className = "" }: BgmToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = BGM_VOLUME;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!enabled) {
      audio.pause();
      return;
    }

    audio.play().catch(() => {
      setEnabled(false);
    });
  }, [enabled]);

  return (
    <button
      type="button"
      className={`pill bgm-toggle ${enabled ? "is-on" : ""} ${className}`.trim()}
      aria-pressed={enabled}
      aria-label={enabled ? "배경음악 끄기" : "배경음악 켜기"}
      title={enabled ? "배경음악 켜짐 — 누르면 끔" : "배경음악 꺼짐 — 누르면 켬"}
      onClick={() => setEnabled((current) => !current)}
    >
      <span className="bgm-ico" aria-hidden="true">
        {enabled ? "🔊" : "🔇"}
      </span>
      <span className="bgm-label">BGM</span>
    </button>
  );
}
