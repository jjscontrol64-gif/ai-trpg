"use client";

import { StatusWindowData } from "@/lib/types";

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const colorClass = pct > 60 ? "hp-high" : pct > 30 ? "hp-mid" : "hp-low";

  return (
    <div className="hp-bar w-full">
      <div
        className={`hp-bar-fill ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function parseHp(hp: string): { current: number; max: number } {
  const [c, m] = hp.split("/").map(Number);
  return { current: c || 0, max: m || 10 };
}

function CharacterCard({
  label,
  data,
  color,
}: {
  label: string;
  data: StatusWindowData["warrior"];
  color: string;
}) {
  const hp = parseHp(data.hp);
  return (
    <div
      className="rounded-[1.25rem] border border-[color:var(--border-color)] bg-[color:var(--bg-panel-soft)] p-4 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color }}>
          {label}
        </span>
        <span className="truncate text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {data.name}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="w-7 text-[0.7rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-red)" }}>
          HP
        </span>
        <HpBar current={hp.current} max={hp.max} />
        <span className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          {data.hp}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { icon: "💪", stat: "STR", value: data.str },
          { icon: "🏃", stat: "DEX", value: data.dex },
          { icon: "💡", stat: "INT", value: data.int },
        ].map((item) => (
          <div
            key={item.stat}
            className="rounded-2xl border border-white/6 bg-black/10 px-2 py-2 text-center"
          >
            <div className="text-[0.65rem] tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              {item.icon} {item.stat}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/6 bg-black/10 px-3 py-3">
        <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          특수 액션
        </div>
        <div className="mt-1 leading-6" style={{ color: "var(--text-secondary)" }}>
          {data.skill}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {[
          ["⛑️ 머리", data.equip[0]],
          ["🧥 몸통", data.equip[1]],
          ["🗡️ 무기", data.equip[2]],
        ].map(([slot, value]) => (
          <div
            key={slot}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-black/10 px-3 py-2"
          >
            <span className="text-[0.68rem] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
              {slot}
            </span>
            <span className="truncate text-right" style={{ color: "var(--text-secondary)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatusWindow({
  warrior,
  amy,
  siluella,
  monster,
  party,
}: StatusWindowData) {
  return (
    <section className="panel-shell">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="panel-kicker">Status Window</p>
          <h2 className="panel-title">파티 상태</h2>
        </div>
        <div className="grid gap-2 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>{party.floor} 층</span>
          <span>📍 {party.loc}</span>
          <span>★ {party.star}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-1 2xl:grid-cols-1">
        <CharacterCard label="⚔️ 전사" data={warrior} color="var(--accent-gold)" />
        <CharacterCard label="🗡️ 에이미" data={amy} color="var(--accent-ember)" />
        <CharacterCard label="🔮 실루엘라" data={siluella} color="var(--accent-blue)" />
      </div>

      {monster && (
        <div
          className="mt-5 rounded-[1.4rem] border border-[color:rgba(196,75,75,0.35)] bg-[linear-gradient(180deg,rgba(120,20,20,0.2),rgba(35,8,8,0.72))] p-4 text-xs shadow-[0_24px_50px_rgba(15,3,3,0.35)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: "var(--accent-red)" }}>
              👹 {monster.name} [{monster.level}]
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              HP {monster.hp}/{monster.maxHp}
            </span>
          </div>
          <HpBar
            current={parseInt(monster.hp, 10)}
            max={parseInt(monster.maxHp, 10)}
          />
          {monster.statusEffect && (
            <div className="mt-2 rounded-2xl bg-black/20 px-3 py-2" style={{ color: "var(--accent-gold)" }}>
              현재 상태: {monster.statusEffect}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-[1.25rem] border border-white/6 bg-black/10 px-4 py-4 text-sm">
        <div className="text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          소지품
        </div>
        <div className="mt-2 leading-6" style={{ color: "var(--text-secondary)" }}>
          🎒 {party.inv}
        </div>
      </div>
    </section>
  );
}
