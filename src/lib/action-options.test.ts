import { describe, expect, it } from "vitest";
import { mapChoicesToActions } from "./action-options";
import { PlayerAction } from "./types";

const puzzleActions: PlayerAction[] = [
  { type: "puzzle_attempt", characterIndex: 0, stat: "str", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 0, stat: "dex", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 0, stat: "int", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 0, stat: "str", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 1, stat: "str", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 1, stat: "dex", useInspiration: false, isUnorthodox: false },
  { type: "puzzle_attempt", characterIndex: 1, stat: "int", useInspiration: false, isUnorthodox: false },
];

describe("mapChoicesToActions", () => {
  it("uses the model-provided actionIndex instead of the choice order", () => {
    const [choice] = mapChoicesToActions(
      [{ actionIndex: 5, label: "에이미 민첩", text: "에이미가 재빠르게 장치를 살핀다" }],
      puzzleActions
    );

    expect(choice.action).toMatchObject({
      type: "puzzle_attempt",
      characterIndex: 1,
      stat: "dex",
    });
  });

  it("accepts numeric string actionIndex values from model JSON", () => {
    const [choice] = mapChoicesToActions(
      [{ actionIndex: "5", label: "에이미 민첩", text: "에이미가 재빠르게 장치를 살핀다" }],
      puzzleActions
    );

    expect(choice.action).toMatchObject({
      characterIndex: 1,
      stat: "dex",
    });
  });

  it("falls back to choice order when actionIndex is missing or invalid", () => {
    const choices = mapChoicesToActions(
      [
        { actionIndex: 999, label: "잘못된 선택", text: "없는 행동을 시도한다" },
        { label: "두 번째", text: "두 번째 행동을 시도한다" },
      ],
      puzzleActions
    );

    expect(choices[0].action).toBe(puzzleActions[0]);
    expect(choices[1].action).toBe(puzzleActions[1]);
  });

  it("keeps up to five model choices", () => {
    const choices = mapChoicesToActions(
      [
        { label: "one", text: "first" },
        { label: "two", text: "second" },
        { label: "three", text: "third" },
        { label: "four", text: "fourth" },
        { label: "five", text: "fifth" },
        { label: "six", text: "sixth" },
      ],
      puzzleActions
    );

    expect(choices).toHaveLength(5);
    expect(choices.map((choice) => choice.label)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
    ]);
  });
});
