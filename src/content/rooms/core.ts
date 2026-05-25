import { RoomDefinition } from "@/lib/registry/types";

export const rooms = [
  { type: "monster", emoji: "M" },
  { type: "puzzle", emoji: "P" },
  { type: "treasure", emoji: "T" },
  { type: "trap", emoji: "!" },
  { type: "safe", emoji: "S" },
  { type: "wall", emoji: "#" },
  { type: "npc", emoji: "N" },
  { type: "boss", emoji: "B" },
  { type: "empty", emoji: "." },
  { type: "entrance", emoji: "E" },
] satisfies RoomDefinition[];
