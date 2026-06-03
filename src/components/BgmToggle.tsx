"use client";

import { useEffect, useRef, useState } from "react";

const BGM_SRC = "/sfx/Beneath_The_Flagstones.mp3";
const BGM_VOLUME = 0.34;

interface BgmToggleProps {
  className?: string;
}

export default function BgmToggle({ className = "" }: BgmToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(true);

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

    const play = () => {
      audio.play().catch(() => {
        // Keep the user's ON intent. Browsers may block playback until a gesture.
      });
    };

    play();

    if (!audio.paused) return;

    window.addEventListener("pointerdown", play, { once: true });
    window.addEventListener("keydown", play, { once: true });

    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [enabled]);

  return (
    <button
      type="button"
      className={`pill bgm-toggle ${enabled ? "is-on" : ""} ${className}`.trim()}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn background music off" : "Turn background music on"}
      title={enabled ? "Turn background music off" : "Turn background music on"}
      onClick={() => setEnabled((current) => !current)}
    >
      <span className="bgm-ico" aria-hidden="true">
        {enabled ? "\u266A" : "\u00D7"}
      </span>
      <span className="bgm-label">BGM</span>
    </button>
  );
}
