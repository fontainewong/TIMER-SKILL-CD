import { changeLastActivation, cooldownStatus, type MatchState, type Usage } from './state.ts';
import type { SkillId } from './skills.ts';

// Temporary UI state only: entering or cancelling never changes the match.
export class ChangeMode {
  private original: Usage | null = null;

  get active(): boolean { return this.original !== null; }
  get usedAt(): number | null { return this.original?.usedAt ?? null; }

  begin(state: MatchState, usage: Usage | undefined = state.usages.at(-1)): boolean {
    if (!state.undo || state.startedAt === null || !state.usages.length) return false;
    if (!usage || usage !== state.usages.at(-1)) return false;
    this.original = usage;
    return true;
  }

  cancel(): void { this.original = null; }

  canSelect(state: MatchState, id: SkillId): boolean {
    if (!this.original || state.usages.at(-1) !== this.original || !state.undo || state.startedAt === null) return false;
    const previous = { ...state, ...state.undo };
    return cooldownStatus(previous, id, state.startedAt + this.original.usedAt * 1000).available;
  }

  select(state: MatchState, id: SkillId): Usage | null {
    if (!this.canSelect(state, id)) return null;
    const replacement = changeLastActivation(state, id);
    if (replacement) this.cancel();
    return replacement;
  }
}
