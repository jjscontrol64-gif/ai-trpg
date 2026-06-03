"use client";

import { useEffect, useState } from "react";
import { StatusWindowData } from "@/lib/types";

// PartyHud.tsx의 SLOTS와 동일한 매핑 (key는 StatusWindowData의 키)
const SEATS = [
  { key: "warrior", img: "/images/characters/warrior.png", pos: "48% 12%" },
  { key: "amy", img: "/images/characters/amy.png", pos: "50% 8%" },
  { key: "siluella", img: "/images/characters/siluella.png", pos: "46% 14%" },
] as const;

const FALLBACK_NAMES = ["레온", "피나", "미나"];

// 활성 좌석별 대기 멘트 — {name}은 실제 캐릭터 이름으로 치환
const LINE_TEMPLATES = [
  "{name}가(이) 검자루를 고쳐 쥐며 어둠을 응시합니다…",
  "{name}가(이) 발소리를 죽이고 그림자 너머를 살핍니다…",
  "{name}가(이) 어둠 너머의 마력을 가늠합니다…",
];

const ROTATE_MS = 1900;

export default function ConferOverlay({
  status,
}: {
  status: StatusWindowData;
}) {
  const seats = SEATS.map((s, i) => {
    const name = status[s.key]?.name ?? FALLBACK_NAMES[i];
    return {
      ...s,
      name,
      line: LINE_TEMPLATES[i].replace("{name}", name),
    };
  });

  // 마지막 좌석(미나)부터 시작 → 시안과 동일한 첫 화면
  const [active, setActive] = useState(seats.length - 1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % seats.length);
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
          {seats.map((s, i) => (
            <div
              key={s.key}
              className={`cm-seat${i === active ? " active" : ""}`}
            >
              <span className="cm-bubble">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <div className="cm-pav">
                <img
                  src={s.img}
                  alt={s.name}
                  style={{ objectPosition: s.pos }}
                />
              </div>
              <span className="cm-name">{s.name}</span>
            </div>
          ))}
        </div>
        <div className="cm-line">{seats[active].line}</div>
        <div className="cm-sub">
          <span className="confer-dots">
            <span></span>
            <span></span>
            <span></span>
          </span>
          동료들이 다음 한 수를 의논합니다
        </div>
      </div>
    </div>
  );
}
