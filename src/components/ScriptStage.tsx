"use client";

import { RefObject } from "react";
import { StoryBeat, MonsterStatusDisplay } from "@/lib/types";
import DiceResult from "./DiceResult";

export default function ScriptStage({
  beats,
  monster,
  isPending,
  logRef,
}: {
  beats: StoryBeat[];
  monster: MonsterStatusDisplay | null;
  isPending: boolean;
  logRef: RefObject<HTMLDivElement | null>;
}) {
  const mPct = monster
    ? Math.max(
        0,
        Math.min(
          100,
          (parseInt(monster.hp, 10) / parseInt(monster.maxHp, 10)) * 100
        )
      )
    : 0;

  return (
    <div className="panel-shell col-narr">
      <div className="narr-head">
        <div>
          <p className="panel-kicker">Scene · Script</p>
          <h2 className="panel-title">대화 / 나레이션</h2>
        </div>
        {isPending ? <span className="narr-busy">처리 중…</span> : null}
      </div>

      <div ref={logRef} className="narr-scroll">
        {monster ? (
          <div className="boss sticky-host">
            <div className="boss-r">
              <span className="boss-nm">
                {monster.level} {monster.name}
              </span>
              <span className="boss-hpv">
                HP {monster.hp} / {monster.maxHp}
              </span>
            </div>
            <span className="hp-bar boss-bar">
              <span className="hp-bar-fill hp-low" style={{ width: `${mPct}%` }} />
            </span>
            {monster.statusEffect ? (
              <span className="boss-eff">🔗 {monster.statusEffect}</span>
            ) : null}
          </div>
        ) : null}

        {beats.map((beat) => {
          if (beat.role === "user") {
            return (
              <div key={beat.id} className="scriptline player">
                <span className="who">▶ 행동</span>
                <span className="said">{beat.text}</span>
              </div>
            );
          }
          return (
            <article key={beat.id} className="beat">
              {beat.diceResult ? (
                <DiceResult result={beat.diceResult} summary={beat.eventSummary} />
              ) : null}
              <div className={`scriptline gm ${beat.diceResult ? "mt" : ""}`}>
                <span className="who">나레이션</span>
                <span className="said">{beat.narration}</span>
              </div>
              {!beat.diceResult && beat.eventSummary ? (
                <div className="beat-summary">{beat.eventSummary}</div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
