import { describe, expect, it } from "vitest";

import { createInitialState } from "./initial-state";
import { buildUserMessage } from "./prompt";
import { EngineResult } from "./types";

describe("buildUserMessage", () => {
  it("keeps current affinity close to the narration request", () => {
    const state = createInitialState("Tester", "normal");
    state.party.affinity = { pina: 2, mina: 1 };

    const engineResult: EngineResult = {
      newState: state,
      eventSummary: "The party looks around the room.",
      nextActions: [{ type: "move", direction: "north" }],
    };

    const message = buildUserMessage(engineResult);

    expect(message).toContain("[현재 관계 상태]");
    expect(message).toContain("에이미 호감도: 2/3");
    expect(message).toContain("실루엘라 호감도: 1/3");
    expect(message).toContain("호감도 수치를 직접 말하지 말고");
  });

  it("keeps remaining boss HP close to the narration request while combat continues", () => {
    const state = createInitialState("테스터", "normal");
    state.phase = "combat";
    state.combat.active = true;
    state.combat.monster = {
      name: "엔드드래곤",
      hp: 12,
      maxHp: 30,
      difficulty: "boss",
      damage: 3,
    };

    const engineResult: EngineResult = {
      newState: state,
      eventSummary: "전사의 공격으로 엔드드래곤에게 피해를 주었다.",
      nextActions: [{ type: "attack", characterIndex: 0, useInspiration: false }],
    };

    const message = buildUserMessage(engineResult, "전사가 검을 휘두른다");

    expect(message).toContain("[현재 전투 상태]");
    expect(message).toContain("보스 HP: 12/30 (잔여 12)");
    expect(message).toContain("전투 종료");
    expect(message).toContain("승리");
    expect(message).toContain("엔딩");
  });
});
