"use client";

import { StatusWindowData } from "@/lib/types";

const SLOTS = [
  { key: "warrior", icon: "⚔️", img: "/images/characters/warrior.png", pos: "48% 12%", role: "전사", color: "var(--accent-gold)" },
  { key: "pina", icon: "🗡️", img: "/images/characters/fina.png", pos: "50% 8%", role: "도적", color: "var(--accent-ember)" },
  { key: "mina", icon: "🔮", img: "/images/characters/mina.png", pos: "46% 14%", role: "마법사", color: "var(--accent-blue)" },
] as const;

function hpPct(hp: string) {
  const [c, m] = hp.split("/").map(Number);
  return m > 0 ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
}

export default function PartyHud({
  status,
  onOpenDrawer,
}: {
  status: StatusWindowData;
  onOpenDrawer: () => void;
}) {
  return (
    <div className="panel-shell hud">
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
        {SLOTS.map((s) => {
          const c = status[s.key];
          const pct = hpPct(c.hp);
          const cls = pct > 60 ? "hp-high" : pct > 30 ? "hp-mid" : "hp-low";
          return (
            <div className="chip" key={s.key}>
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
