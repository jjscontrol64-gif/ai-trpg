"use client";

import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { StoryBeat, MonsterStatusDisplay } from "@/lib/types";
import DiceResult from "./DiceResult";

export interface AttackFxEvent {
  id: string;
  effect: string;
  damage: number;
  crit: boolean;
  color: string;
  turns?: number;
}

const ATTACK_SFX: Record<string, string> = {
  slash: "/sfx/argon-slash.wav",
  smash: "/sfx/argon-heavy-hit.wav",
  stab: "/sfx/fina-stab.wav",
  ambush: "/sfx/fina-backstab.wav",
  magic: "/sfx/mina-arcane-bolt.wav",
  bind: "/sfx/mina-arcane-bind.wav",
};

export default function ScriptStage({
  beats,
  monster,
  isPending,
  logRef,
  attackFxEvent,
}: {
  beats: StoryBeat[];
  monster: MonsterStatusDisplay | null;
  isPending: boolean;
  logRef: RefObject<HTMLDivElement | null>;
  attackFxEvent: AttackFxEvent | null;
}) {
  const [fxScriptReady, setFxScriptReady] = useState(false);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const fxLayerRef = useRef<HTMLDivElement | null>(null);
  const sfxRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastSfxEventIdRef = useRef<string | null>(null);
  const fxInstanceRef = useRef<{
    play: (name: string, opts?: Record<string, unknown>) => void;
    ctx: { bound: (on: boolean) => void };
  } | null>(null);
  const [retainedMonster, setRetainedMonster] =
    useState<MonsterStatusDisplay | null>(null);
  const [defeatingMonster, setDefeatingMonster] = useState(false);
  const displayMonster = useMemo(() => {
    if (monster) return monster;
    if (!retainedMonster) return null;

    return defeatingMonster
      ? { ...retainedMonster, hp: "0", statusEffect: undefined }
      : retainedMonster;
  }, [defeatingMonster, monster, retainedMonster]);
  const mPct = displayMonster
    ? Math.max(
        0,
        Math.min(
          100,
          (parseInt(displayMonster.hp, 10) / parseInt(displayMonster.maxHp, 10)) * 100
        )
      )
    : 0;

  useEffect(() => {
    if (monster) {
      setRetainedMonster(monster);
      setDefeatingMonster(false);
    }
  }, [monster]);

  useEffect(() => {
    if (monster || !attackFxEvent || !retainedMonster) return;

    setDefeatingMonster(true);
    const clearTimer = window.setTimeout(() => {
      setRetainedMonster(null);
      setDefeatingMonster(false);
      fxInstanceRef.current = null;
    }, 1300);

    return () => window.clearTimeout(clearTimer);
  }, [attackFxEvent, monster, retainedMonster]);

  useEffect(() => {
    if (!displayMonster) {
      fxInstanceRef.current = null;
      return;
    }

    const FX = (window as typeof window & {
      AttackFX?: {
        create: (args: {
          arena: HTMLElement;
          target: HTMLElement;
          fxLayer: HTMLElement;
        }) => {
          play: (name: string, opts?: Record<string, unknown>) => void;
          ctx: { bound: (on: boolean) => void };
        };
      };
    }).AttackFX;

    if (!fxScriptReady || !FX || !arenaRef.current || !targetRef.current || !fxLayerRef.current) {
      return;
    }

    fxInstanceRef.current = FX.create({
      arena: arenaRef.current,
      target: targetRef.current,
      fxLayer: fxLayerRef.current,
    });
  }, [displayMonster, fxScriptReady]);

  useEffect(() => {
    const sfx = new Map<string, HTMLAudioElement>();

    Object.entries(ATTACK_SFX).forEach(([effect, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 0.58;
      sfx.set(effect, audio);
    });

    sfxRef.current = sfx;

    return () => {
      sfx.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      sfx.clear();
    };
  }, []);

  useEffect(() => {
    if (!attackFxEvent || lastSfxEventIdRef.current === attackFxEvent.id) return;

    lastSfxEventIdRef.current = attackFxEvent.id;
    const audio = sfxRef.current.get(attackFxEvent.effect);
    if (!audio) return;

    audio.currentTime = 0;
    audio
      .play()
      .catch(() => {
        // Browser audio policy can reject playback before the first trusted gesture.
      });
  }, [attackFxEvent]);

  useEffect(() => {
    if (!attackFxEvent || !fxInstanceRef.current) return;

    fxInstanceRef.current.play(attackFxEvent.effect, {
      damage: attackFxEvent.damage,
      crit: attackFxEvent.crit,
      color: attackFxEvent.color,
      turns: attackFxEvent.turns,
    });
  }, [attackFxEvent, fxScriptReady]);

  useEffect(() => {
    if (!displayMonster?.statusEffect) {
      fxInstanceRef.current?.ctx.bound(false);
    }
  }, [displayMonster?.statusEffect]);

  return (
    <div className="panel-shell col-narr">
      <Script
        src="/attack-fx.js"
        strategy="afterInteractive"
        onLoad={() => setFxScriptReady(true)}
      />
      <div className="narr-head">
        <div>
          <p className="panel-kicker">Scene · Script</p>
          <h2 className="panel-title">대화 / 나레이션</h2>
        </div>
        {isPending ? <span className="narr-busy">처리 중…</span> : null}
      </div>

      <div ref={logRef} className="narr-scroll">
        {displayMonster ? (
          <div
            className={`boss sticky-host ${
              displayMonster.statusEffect ? "fx-bound-arena" : ""
            } ${
              defeatingMonster ? "boss-defeated" : ""
            }`}
          >
            <div ref={arenaRef} className="boss-stage fx-arena">
              <div ref={targetRef} className="fx-target boss-fx-target">
                <span className="glyph" aria-hidden="true">
                  💀
                </span>
              </div>
              <div ref={fxLayerRef} className="fx-layer boss-fx-layer" />
            </div>

            <div className="boss-meta">
              <div className="boss-r">
              <span className="boss-nm">
                {displayMonster.level} {displayMonster.name}
              </span>
              <span className="boss-hpv">
                HP {displayMonster.hp} / {displayMonster.maxHp}
              </span>
            </div>
              <span className="hp-bar boss-bar">
                <span className="hp-bar-fill hp-low" style={{ width: `${mPct}%` }} />
              </span>
            </div>
            {displayMonster.statusEffect ? (
              <span className="boss-eff">🔗 {displayMonster.statusEffect}</span>
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
