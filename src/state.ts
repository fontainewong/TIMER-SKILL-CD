import { SKILLS, skillById, type SkillId } from './skills.ts';
import { elapsedMs } from './timer.ts';

export interface Usage { skillId: SkillId; usedAt: number; readyAt: number }
export interface Snapshot { order: SkillId[]; usages: Usage[] }
export interface MatchState extends Snapshot {
  startedAt: number | null;
  undo: Snapshot | null;
}

export function createMatch(): MatchState {
  return { startedAt: null, order: SKILLS.map(skill => skill.id), usages: [], undo: null };
}

export function cooldownStatus(state: MatchState, id: SkillId, now = Date.now()) {
  const skill = skillById(id);
  const last = state.usages.findLast(usage => usage.skillId === id);
  const readyAt = last?.readyAt ?? skill.initial;
  const duration = last ? skill.cooldown : skill.initial;
  const remaining = Math.max(0, readyAt - elapsedMs(state.startedAt, now) / 1000);
  return { readyAt, remaining, fraction: Math.min(1, remaining / duration), available: state.startedAt !== null && remaining === 0 };
}

export function activateSkill(state: MatchState, id: SkillId, now = Date.now()): Usage | null {
  if (!cooldownStatus(state, id, now).available) return null;
  state.undo = { order: [...state.order], usages: state.usages.map(usage => ({ ...usage })) };
  const usedAt = elapsedMs(state.startedAt, now) / 1000;
  const usage = { skillId: id, usedAt, readyAt: usedAt + skillById(id).cooldown };
  state.usages.push(usage);
  const position = state.order.indexOf(id);
  [state.order[0], state.order[position]] = [state.order[position], state.order[0]];
  return usage;
}

export function undoActivation(state: MatchState): boolean {
  if (!state.undo) return false;
  state.order = [...state.undo.order];
  state.usages = state.undo.usages.map(usage => ({ ...usage }));
  state.undo = null;
  return true;
}

export function changeLastActivation(state: MatchState, id: SkillId): Usage | null {
  const original = state.usages.at(-1);
  if (!state.undo || !original || state.startedAt === null) return null;
  if (original.skillId === id) return original;
  // Reapply to the pre-activation snapshot at the original time, never the correction time.
  const previous: MatchState = {
    startedAt: state.startedAt,
    order: [...state.undo.order],
    usages: state.undo.usages.map(usage => ({ ...usage })),
    undo: null,
  };
  const replacement = activateSkill(previous, id, state.startedAt + original.usedAt * 1000);
  if (!replacement) return null;
  replacement.usedAt = original.usedAt;
  replacement.readyAt = original.usedAt + skillById(id).cooldown;
  state.order = previous.order;
  state.usages = previous.usages;
  return replacement;
}

function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Snapshot;
  return Array.isArray(snapshot.order) && snapshot.order.length === SKILLS.length
    && new Set(snapshot.order).size === SKILLS.length
    && snapshot.order.every(id => SKILLS.some(skill => skill.id === id))
    && Array.isArray(snapshot.usages) && snapshot.usages.every(usage => usage &&
      SKILLS.some(skill => skill.id === usage.skillId) && Number.isFinite(usage.usedAt)
      && usage.usedAt >= 0 && Number.isFinite(usage.readyAt)
      && usage.readyAt === usage.usedAt + skillById(usage.skillId).cooldown);
}

export function parseSavedMatch(raw: string | null, now = Date.now()): MatchState {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1 || !validSnapshot(value.state)) return createMatch();
    const state = value.state as MatchState;
    if (!(state.startedAt === null || (Number.isFinite(state.startedAt) && state.startedAt >= 0 && state.startedAt <= now))) return createMatch();
    if (!(state.undo === null || validSnapshot(state.undo))) return createMatch();
    if (state.startedAt === null && (state.usages.length || state.undo !== null)) return createMatch();
    return state;
  } catch { return createMatch(); }
}
