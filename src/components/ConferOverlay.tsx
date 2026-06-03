"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatusWindowData } from "@/lib/types";

const SEATS = [
  { key: "warrior", img: "/images/characters/warrior.png", pos: "48% 12%" },
  { key: "pina", img: "/images/characters/fina.png", pos: "50% 8%" },
  { key: "mina", img: "/images/characters/mina.png", pos: "46% 14%" },
] as const;

const FALLBACK_NAMES = ["레온", "에이미", "실루엘라"];

const LINE_TEMPLATES = [
  "{name}이(가) 검 끝을 고쳐 쥐며 다음 수를 가늠합니다.",
  "{name}이(가) 발소리를 낮추고 주변의 기척을 살핍니다.",
  "{name}이(가) 남은 마력을 정리하며 흐름을 읽습니다.",
];

const ROTATE_MS = 1900;

interface ConferOverlayProps {
  status: StatusWindowData;
}

export default function ConferOverlay({ status }: ConferOverlayProps) {
  const seats = useMemo(
    () =>
      SEATS.map((seat, index) => {
        const name = status[seat.key]?.name ?? FALLBACK_NAMES[index];

        return {
          ...seat,
          name,
          line: LINE_TEMPLATES[index].replace("{name}", name),
        };
      }),
    [status]
  );
  const [active, setActive] = useState(seats.length - 1);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % seats.length);
    }, ROTATE_MS);

    return () => window.clearInterval(id);
  }, [seats.length]);

  return (
    <div
      className="confer-overlay"
      role="status"
      aria-live="polite"
      aria-label="다음 장면을 준비하는 중"
    >
      <div className="confer-modal">
        <p className="cm-kicker">GM이 다음 장면을 준비합니다</p>
        <div className="cm-seats">
          {seats.map((seat, index) => (
            <div
              key={seat.key}
              className={`cm-seat${index === active ? " active" : ""}`}
            >
              <span className="cm-bubble" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <div className="cm-pav">
                <img
                  src={seat.img}
                  alt={seat.name}
                  style={{ objectPosition: seat.pos }}
                />
              </div>
              <span className="cm-name">{seat.name}</span>
            </div>
          ))}
        </div>
        <div className="cm-line">{seats[active].line}</div>
        <div className="cm-sub">
          <span className="confer-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          동료들이 다음 수를 논의합니다
        </div>
      </div>
    </div>
  );
}
