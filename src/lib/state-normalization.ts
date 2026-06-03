import { consumableDefinitions } from "./registry/generated";
import { createItemInstanceId } from "./item-id";
import { Affinity, AffinityLevel, ConsumableItem, GameState } from "./types";

export const DEFAULT_AFFINITY: Affinity = {
  amy: 0,
  siluella: 0,
};

function normalizeAffinityLevel(value: unknown): AffinityLevel {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

export function normalizeAffinity(value: unknown): Affinity {
  const candidate = value as
    | (Partial<Affinity> & {
        pina?: AffinityLevel;
        mina?: AffinityLevel;
      })
    | undefined;
  return {
    amy: normalizeAffinityLevel(candidate?.amy ?? candidate?.pina),
    siluella: normalizeAffinityLevel(candidate?.siluella ?? candidate?.mina),
  };
}

const consumableAliases: Record<string, string> = {
  치료물약: "heal-potion",
  회복물약: "heal-potion",
  상급치료물약: "superior-heal-potion",
  상급회복물약: "superior-heal-potion",
  마나물약: "mana-potion",
  엘릭서: "elixir",
  성녀의눈물: "saint-tear",
};

function normalizeConsumableKey(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeConsumableItem(
  item: ConsumableItem,
  seenItemIds: Set<string>
): ConsumableItem {
  const itemIdKey = normalizeConsumableKey(item.id);
  const itemNameKey = normalizeConsumableKey(item.name);
  const aliasId = consumableAliases[itemNameKey] ?? consumableAliases[itemIdKey];
  const definition = consumableDefinitions.find(
    (candidate) =>
      candidate.id === item.id ||
      candidate.id === aliasId ||
      normalizeConsumableKey(candidate.id) === itemIdKey ||
      normalizeConsumableKey(candidate.name) === itemNameKey
  );

  const shouldReissueId = seenItemIds.has(item.id);
  const id = shouldReissueId ? createItemInstanceId() : item.id;
  seenItemIds.add(id);

  if (!definition) {
    return shouldReissueId ? { ...item, id } : item;
  }

  return {
    ...item,
    id,
    name: definition.name,
    rarity: item.rarity || definition.rarity,
    effectId: item.effectId ?? definition.effectId,
    effectValue: item.effectValue ?? definition.effectValue,
    hpRestore: item.hpRestore ?? definition.hpRestore,
    allHpRestore: item.allHpRestore ?? definition.allHpRestore,
    actionRestore: item.actionRestore ?? definition.actionRestore,
  };
}

export function normalizeGameState(state: GameState): GameState {
  const normalized = structuredClone(state);
  normalized.party.affinity = normalizeAffinity(
    (state as Partial<GameState>).party?.affinity
  );
  const seenItemIds = new Set<string>();
  normalized.party.inventory = normalized.party.inventory.map((item) =>
    normalizeConsumableItem(item, seenItemIds)
  );
  return normalized;
}
