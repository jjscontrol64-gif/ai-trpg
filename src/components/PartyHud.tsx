"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { HealFxEvent, StatusWindowData } from "@/lib/types";

type HealFxInstance = {
  play: (type: "heal" | "allheal" | "action", opts?: {
    label?: string;
    bars?: HTMLElement[];
    count?: number;
  }) => void;
};

type HealFxGlobal = {
  HealFX?: {
    create: (args: { chip: HTMLElement }) => HealFxInstance;
  };
};

const PLAY_TYPE = {
  heal: "heal",
  allheal: "allheal",
  action: "action",
} as const;

const SLOTS = [
  { key: "warrior", icon: "⚔️", img: "/images/characters/warrior.png", pos: "48% 12%", role: "전사", color: "var(--accent-gold)" },
  { key: "amy", icon: "🗡️", img: "/images/characters/amy.png", pos: "50% 8%", role: "도적", color: "var(--accent-ember)" },
  { key: "siluella", icon: "🔮", img: "/images/characters/siluella.png", pos: "46% 14%", role: "마법사", color: "var(--accent-blue)" },
] as const;

function hpPct(hp: string) {
  const [c, m] = hp.split("/").map(Number);
  return m > 0 ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
}

export default function PartyHud({
  status,
  healFxEvent,
  onOpenDrawer,
}: {
  status: StatusWindowData;
  healFxEvent: HealFxEvent | null;
  onOpenDrawer: () => void;
}) {
  const [fxReady, setFxReady] = useState(false);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fxRefs = useRef<(HealFxInstance | null)[]>([]);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    const FX = (window as typeof window & HealFxGlobal).HealFX;
    if (!fxReady || !FX) return;

    fxRefs.current = chipRefs.current.map((chip) =>
      chip ? FX.create({ chip }) : null
    );
  }, [fxReady]);

  useEffect(() => {
    if (!fxReady || !healFxEvent || lastEventId.current === healFxEvent.id) {
      return;
    }

    lastEventId.current = healFxEvent.id;
    healFxEvent.targets.forEach(({ index, kind, amount }) => {
      const fx = fxRefs.current[index];
      const chip = chipRefs.current[index];
      if (!fx || !chip) return;

      const fill = chip.querySelector<HTMLElement>(".hp-bar-fill");
      fx.play(PLAY_TYPE[kind], {
        label: kind === "action" ? `Action +${amount}` : `+${amount}`,
        bars: kind === "action" || !fill ? [] : [fill],
      });
    });
  }, [fxReady, healFxEvent]);

  return (
    <div className="panel-shell hud">
      <Script
        src="/heal-fx.js"
        strategy="afterInteractive"
        onReady={() => setFxReady(true)}
      />
      <div className="hud-meta">
        <span className="hud-name">파티 상태</span>
        <div className="hud-tags">
          <span className="hud-tag">{status.party.floor} 층</span>
          <span className="hud-tag">📍 {status.party.loc}</span>
        </div>
        <span className="hud-stars">★ {status.party.star}</span>
        <button type="button" className="hud-bag" onClick={onOpenDrawer}>
          🎒 상세
        </button>
      </div>

      <div className="hud-chips">
        {SLOTS.map((s, index) => {
          const c = status[s.key];
          const pct = hpPct(c.hp);
          const cls = pct > 60 ? "hp-high" : pct > 30 ? "hp-mid" : "hp-low";
          return (
            <div
              className="chip"
              key={s.key}
              ref={(element) => {
                chipRefs.current[index] = element;
              }}
            >
              <span className="pav">
                <img
                  src={s.img}
                  alt={c.name}
                  style={{ objectPosition: s.pos }}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <div className="chip-body">
                <div className="chip-top">
                  <span className="chip-nm">{c.name}</span>
                  <span className="chip-role" style={{ color: s.color }}>
                    {s.role}
                  </span>
                </div>
                <div className="chip-hp">
                  <span className="chip-hp-lbl">HP</span>
                  <span className="hp-bar">
                    <span
                      className={`hp-bar-fill ${cls}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="chip-hp-v">{c.hp}</span>
                </div>
                <div className="chip-meta">
                  <div className="chip-meta-row chip-meta-stats">
                    <span className="chip-stats">
                    💪{c.str} · 🏃{c.dex} · 💡{c.int}
                    </span>
                  </div>
                  <div className="chip-meta-row chip-meta-detail">
                    {c.affinity ? (
                    <span className="chip-affinity" title="호감도">
                      {c.affinity}
                    </span>
                  ) : null}
                    <span className="chip-skill" title={c.skill}>
                      {c.skill}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
