import { Affinity, AffinityLevel, GameState } from "./types";

export const DEFAULT_AFFINITY: Affinity = {
  pina: 0,
  mina: 0,
};

function normalizeAffinityLevel(value: unknown): AffinityLevel {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

export function normalizeAffinity(value: unknown): Affinity {
  const candidate = value as Partial<Affinity> | undefined;
  return {
    pina: normalizeAffinityLevel(candidate?.pina),
    mina: normalizeAffinityLevel(candidate?.mina),
  };
}

export function normalizeGameState(state: GameState): GameState {
  const normalized = structuredClone(state);
  normalized.party.affinity = normalizeAffinity(
    (state as Partial<GameState>).party?.affinity
  );
  return normalized;
}
