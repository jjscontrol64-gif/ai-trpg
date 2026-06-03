import { ItemEffectDefinition } from "@/lib/registry/types";

export const itemEffects = [
  {
    id: "restore_hp",
    apply: ({ state, item, targetIndex, getNextActions }) => {
      const target = targetIndex ?? 0;
      const member = state.party.members[target];
      const amount = item.effectValue ?? item.hpRestore ?? 0;
      member.hp = Math.min(member.maxHp, member.hp + amount);

      return {
        state,
        eventSummary: `${member.name}가(이) ${item.name} 사용. HP +${amount} 회복.`,
        nextActions: getNextActions(state),
      };
    },
  },
  {
    id: "restore_all_hp",
    apply: ({ state, item, getNextActions }) => {
      const amount = item.effectValue ?? item.allHpRestore ?? 0;
      for (const member of state.party.members) {
        if (member.hp > 0) {
          member.hp = Math.min(member.maxHp, member.hp + amount);
        }
      }

      return {
        state,
        eventSummary: `${item.name} 사용. 전원 HP +${amount} 회복.`,
        nextActions: getNextActions(state),
      };
    },
  },
  {
    id: "restore_action",
    apply: ({ state, item, targetIndex, getNextActions }) => {
      const target = targetIndex ?? 0;
      const member = state.party.members[target];
      const amount = item.effectValue ?? item.actionRestore ?? 0;
      for (const action of member.actions) {
        action.remaining = Math.min(action.max, action.remaining + amount);
      }

      return {
        state,
        eventSummary: `${member.name}가(이) ${item.name} 사용. 특수액션 +${amount} 회복.`,
        nextActions: getNextActions(state),
      };
    },
  },
] satisfies ItemEffectDefinition[];
