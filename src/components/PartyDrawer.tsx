"use client";

import { useEffect } from "react";
import InventoryPanel from "@/components/InventoryPanel";
import { ChoiceOption, GameState, StatusWindowData } from "@/lib/types";

const SLOTS = [
  { key: "warrior", icon: "⚔️", role: "전사", color: "var(--accent-gold)" },
  { key: "pina", icon: "🗡️", role: "도적", color: "var(--accent-ember)" },
  { key: "mina", icon: "🔮", role: "마법사", color: "var(--accent-blue)" },
] as const;

const EQUIP_LABELS = ["⛑️ 머리", "🧥 몸통", "🗡️ 무기"] as const;

export default function PartyDrawer({
  open,
  onClose,
  status,
  inventory,
  members,
  onUse,
  inventoryDisabled,
  onSave,
  onExport,
  saveStatus,
  actionsDisabled,
}: {
  open: boolean;
  onClose: () => void;
  status: StatusWindowData;
  inventory: GameState["party"]["inventory"];
  members: GameState["party"]["members"];
  onUse: (choice: ChoiceOption) => void;
  inventoryDisabled: boolean;
  onSave: () => void;
  onExport: () => void;
  saveStatus: "idle" | "saved" | "error";
  actionsDisabled: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="drawer-head">
          <h2 className="panel-title">🎒 상세</h2>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="drawer-sect">
          <p className="drawer-sect-title">저장</p>
          <div className="drawer-actions">
            <button
              type="button"
              className="mini-btn"
              onClick={onSave}
              disabled={actionsDisabled}
            >
              {saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Save failed"
                  : "Save"}
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={onExport}
              disabled={actionsDisabled}
            >
              Export
            </button>
          </div>
        </div>

        <div className="drawer-sect">
          <p className="drawer-sect-title">파티 · 장비 / 특수 액션</p>
          {SLOTS.map((s) => {
            const c = status[s.key];
            return (
              <div className="dchar" key={s.key}>
                <div className="dchar-top">
                  <span className="dchar-nm">
                    {s.icon} {c.name}
                  </span>
                  <span className="dchar-role" style={{ color: s.color }}>
                    {s.role}
                  </span>
                </div>
                <div className="dchar-skill">{c.skill}</div>
                <div className="dchar-equip">
                  {EQUIP_LABELS.map((label, i) => (
                    <div className="dchar-equip-row" key={label}>
                      <span className="slot">{label}</span>
                      <span>{c.equip[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="drawer-sect">
          <p className="drawer-sect-title">인벤토리</p>
          <InventoryPanel
            inventory={inventory}
            members={members}
            onUse={onUse}
            disabled={inventoryDisabled}
          />
        </div>

        <div className="drawer-sect">
          <p className="drawer-sect-title">핵심 규칙</p>
          <div className="drule">정석적 선택: `1d20 + 스탯 + 영감`</div>
          <div className="drule">비정석적 선택: `1d20`만 사용, 15 이상이면 성공</div>
          <div className="drule">영감은 최대 `★★★`, 사용 시 다음 판정에 `+5`</div>
        </div>
      </aside>
    </>
  );
}
