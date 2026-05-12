import { GameState, RoomData, PlayerAction } from "../types";
import { floorSize, roomTypeEmoji } from "../dungeon-data";

const colOrder = "ABCDEFG";

function colIndex(col: string): number {
  return colOrder.indexOf(col);
}

function colFromIndex(idx: number): string {
  return colOrder[idx];
}

export function getAdjacentPosition(
  col: string,
  row: number,
  direction: "north" | "south" | "east" | "west"
): { col: string; row: number } {
  switch (direction) {
    case "north":
      return { col, row: row - 1 };
    case "south":
      return { col, row: row + 1 };
    case "east":
      return { col: colFromIndex(colIndex(col) + 1), row };
    case "west":
      return { col: colFromIndex(colIndex(col) - 1), row };
  }
}

export function isValidPosition(floor: number, col: string, row: number): boolean {
  const size = floorSize[floor];
  if (!size) return false;
  return size.cols.includes(col) && size.rows.includes(row);
}

export function getRoomAt(state: GameState, col: string, row: number): RoomData | null {
  const key = `${col},${row}`;
  const dungeon = state.dungeons[state.party.floor - 1];
  return dungeon[key] ?? null;
}

export function getRoomKey(col: string, row: number): string {
  return `${col},${row}`;
}

export function getAvailableDirections(state: GameState): PlayerAction[] {
  const { col, row } = state.party.position;
  const floor = state.party.floor;
  const directions: ("north" | "south" | "east" | "west")[] = [
    "north",
    "south",
    "east",
    "west",
  ];
  const actions: PlayerAction[] = [];

  for (const dir of directions) {
    const pos = getAdjacentPosition(col, row, dir);
    if (!isValidPosition(floor, pos.col, pos.row)) continue;
    const room = getRoomAt(state, pos.col, pos.row);
    if (!room || room.type === "wall") continue;
    actions.push({ type: "move", direction: dir });
  }

  return actions;
}

export function getRoomDescription(room: RoomData): string {
  const emoji = roomTypeEmoji[room.type] || "?";
  const diffLabel = room.monsterDifficulty
    ? ["", "Ⅰ", "Ⅱ", "Ⅲ"][room.monsterDifficulty]
    : "";
  return `${emoji}${diffLabel}`;
}

export function getDirectionLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: "북쪽",
    south: "남쪽",
    east: "동쪽",
    west: "서쪽",
  };
  return labels[dir] || dir;
}
