import { activateSkill, cooldownStatus, type MatchState, type Usage } from './state.ts';
import type { SkillId } from './skills.ts';

export function isSkillLocked(state: MatchState, id: SkillId): boolean {
  const selected = state.usages.at(-1)?.skillId;
  return selected !== undefined && selected !== id;
}

export function tapSkill(state: MatchState, id: SkillId, now = Date.now()): { usage: Usage; recorded: boolean } | null {
  if (isSkillLocked(state, id)) return null;
  if (cooldownStatus(state, id, now).available) {
    const usage = activateSkill(state, id, now)!;
    return { usage, recorded: true };
  }
  const usage = state.usages.findLast(event => event.skillId === id);
  return usage ? { usage, recorded: false } : null;
}

export function canCorrectUsage(state: MatchState, usage: Usage | null): boolean {
  return !!usage && !!state.undo && state.usages.at(-1) === usage;
}
