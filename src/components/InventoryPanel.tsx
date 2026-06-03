"use client";

import {
  canUseBagItem,
  describeBagItem,
  getBagItemTargetIndex,
} from "@/lib/item-usage";
import { ChoiceOption, ConsumableItem, GameState } from "@/lib/types";

type InventoryPanelProps = {
  inventory: ConsumableItem[];
  members: GameState["party"]["members"];
  onUse: (choice: ChoiceOption) => void;
  disabled?: boolean;
};

type ItemStack = {
  item: ConsumableItem;
  inventoryIndex: number;
  count: number;
};

function buildUseItemChoice(
  item: ConsumableItem,
  inventoryIndex: number,
  members: GameState["party"]["members"]
): ChoiceOption {
  const targetIndex = getBagItemTargetIndex(item, members);
  const target = targetIndex === undefined ? null : members[targetIndex];
  const targetText = target ? `${target.name}에게 ` : "";

  return {
    label: item.name,
    text: `${targetText}${item.name}을 사용한다.`,
    action: {
      type: "use_item",
      itemId: item.id,
      inventoryIndex,
      ...(targetIndex === undefined ? {} : { targetIndex }),
    },
  };
}

function getUsableStacks(
  inventory: ConsumableItem[],
  members: GameState["party"]["members"]
): ItemStack[] {
  const stacks = new Map<string, ItemStack>();

  for (const [inventoryIndex, item] of inventory.entries()) {
    if (!canUseBagItem(item, members)) continue;

    const existing = stacks.get(item.name);
    if (existing) {
      existing.count += 1;
    } else {
      stacks.set(item.name, { item, inventoryIndex, count: 1 });
    }
  }

  return Array.from(stacks.values());
}

export default function InventoryPanel({
  inventory,
  members,
  onUse,
  disabled = false,
}: InventoryPanelProps) {
  const stacks = getUsableStacks(inventory, members);

  return (
    <section className="panel-shell">
      <div>
        <p className="panel-kicker">Inventory</p>
        <h2 className="panel-title">인벤토리</h2>
      </div>

      {stacks.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {stacks.map(({ item, inventoryIndex, count }) => (
            <button
              key={item.name}
              type="button"
              onClick={() => onUse(buildUseItemChoice(item, inventoryIndex, members))}
              disabled={disabled}
              className="flex min-h-14 items-center justify-between gap-3 rounded-[1.1rem] border border-white/8 bg-black/10 px-4 py-3 text-left text-sm transition hover:-translate-y-px hover:border-[color:rgba(218,183,107,0.35)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              <span className="min-w-0">
                <span
                  className="block truncate font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.name}
                  {count > 1 ? ` x${count}` : ""}
                </span>
                <span
                  className="mt-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {describeBagItem(item)}
                </span>
              </span>
              <span
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--accent-gold)" }}
              >
                사용
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="mt-5 rounded-[1.1rem] border border-white/6 bg-black/10 px-4 py-4 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          사용할 수 있는 아이템이 없습니다
        </div>
      )}
    </section>
  );
}
