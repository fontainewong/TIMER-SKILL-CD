import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateSkill, changeLastActivation, cooldownStatus, createMatch, parseSavedMatch, undoActivation } from '../src/state.ts';
import { elapsedMs, formatTime } from '../src/timer.ts';

test('initial availability respects all six configured timings', () => {
  const state = createMatch();
  assert.equal(cooldownStatus(state, 'blink', 100_000).available, false);
  state.startedAt = 1_000;
  for (const [id, delay] of [['blink', 60], ['warp', 50], ['excitement', 40], ['patroller', 30], ['abnormal', 40], ['teleport', 45]] as const) {
    assert.equal(cooldownStatus(state, id, 1_000 + delay * 1000 - 1).available, false);
    assert.equal(cooldownStatus(state, id, 1_000 + delay * 1000).available, true);
  }
});

test('activation swaps only selected and first card, with accurate timestamps', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  const usage = activateSkill(state, 'patroller', 61_250);
  assert.deepEqual(state.order, ['patroller', 'warp', 'excitement', 'blink', 'abnormal', 'teleport']);
  assert.deepEqual(usage, { skillId: 'patroller', usedAt: 60.25, readyAt: 150.25 });
  assert.equal(activateSkill(state, 'patroller', 62_000), null);
  assert.equal(cooldownStatus(state, 'blink', 62_000).available, true);
  assert.equal(cooldownStatus(state, 'patroller', 151_250).available, true);
  const order = [...state.order];
  activateSkill(state, 'patroller', 151_250);
  assert.deepEqual(state.order, order);
});

test('undo restores prior cooldown, usage records and order without rewinding timer', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'patroller', 61_000);
  const prior = structuredClone(state);
  activateSkill(state, 'teleport', 62_000);
  assert.equal(undoActivation(state), true);
  assert.deepEqual(state.order, prior.order);
  assert.deepEqual(state.usages, prior.usages);
  assert.equal(state.startedAt, 1_000);
  assert.equal(undoActivation(state), false);
});

test('background time and refresh restoration preserve elapsed cooldowns and undo', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_000);
  const restored = parseSavedMatch(JSON.stringify({ version: 1, state }), 301_000);
  assert.deepEqual(restored, state);
  assert.equal(elapsedMs(restored.startedAt, 301_000), 300_000);
  assert.equal(cooldownStatus(restored, 'blink', 301_000).available, true);
  assert.equal(undoActivation(restored), true);
  assert.equal(formatTime(300), '05:00');
});

test('invalid storage falls back safely and reset creates the complete initial state', () => {
  for (const raw of ['invalid', '{}', JSON.stringify({ version: 1, state: { ...createMatch(), order: Array(6).fill('blink') } })]) {
    assert.deepEqual(parseSavedMatch(raw), createMatch());
  }
  const state = createMatch();
  assert.equal(state.startedAt, null);
  assert.equal(state.undo, null);
  assert.deepEqual(state.usages, []);
  assert.deepEqual(state.order, ['blink', 'warp', 'excitement', 'patroller', 'abnormal', 'teleport']);
});

test('changing Blink at 01:10 to Warp preserves the 01:00 activation timestamp', context => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_000);
  context.mock.method(Date, 'now', () => 71_000);
  const replacement = changeLastActivation(state, 'warp');
  assert.deepEqual(replacement, { skillId: 'warp', usedAt: 60, readyAt: 160 });
  assert.equal(formatTime(replacement!.usedAt), '01:00');
  assert.equal(formatTime(replacement!.readyAt), '02:40');
  assert.equal(state.usages.length, 1);
  assert.equal(cooldownStatus(state, 'warp', 71_000).remaining, 90);
  assert.equal(cooldownStatus(state, 'blink', 71_000).available, true);
  assert.deepEqual(state.order, ['warp', 'blink', 'excitement', 'patroller', 'abnormal', 'teleport']);
});

test('change restores earlier Blink history and position without changing unrelated skills', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_000);
  activateSkill(state, 'patroller', 201_000);
  const previous = structuredClone(state);
  activateSkill(state, 'blink', 211_000);
  changeLastActivation(state, 'warp');
  assert.deepEqual(state.usages.slice(0, -1), previous.usages);
  assert.deepEqual(state.usages.at(-1), { skillId: 'warp', usedAt: 210, readyAt: 310 });
  assert.equal(cooldownStatus(state, 'blink', 221_000).readyAt, 210);
  assert.deepEqual(cooldownStatus(state, 'patroller', 221_000), cooldownStatus(previous, 'patroller', 221_000));
  assert.deepEqual(state.order, ['warp', 'patroller', 'excitement', 'blink', 'abnormal', 'teleport']);
  assert.equal(state.startedAt, previous.startedAt);
  undoActivation(state);
  assert.deepEqual(state.order, previous.order);
  assert.deepEqual(state.usages, previous.usages);
});

test('repeated corrections and refresh preserve the original fractional timestamp and undo', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_250);
  changeLastActivation(state, 'warp');
  const restored = parseSavedMatch(JSON.stringify({ version: 1, state }), 100_000);
  changeLastActivation(restored, 'teleport');
  assert.deepEqual(restored.usages, [{ skillId: 'teleport', usedAt: 60.25, readyAt: 160.25 }]);
  const before = structuredClone(restored);
  changeLastActivation(restored, 'teleport');
  assert.deepEqual(restored, before);
  undoActivation(restored);
  assert.deepEqual(restored.usages, []);
  assert.deepEqual(restored.order, createMatch().order);
});

test('change rejects a skill unavailable at the original timestamp without mutating state', () => {
  const state = createMatch();
  assert.equal(changeLastActivation(state, 'warp'), null);
  state.startedAt = 1_000;
  activateSkill(state, 'patroller', 31_000);
  const before = structuredClone(state);
  assert.equal(changeLastActivation(state, 'warp'), null);
  assert.deepEqual(state, before);
  activateSkill(state, 'warp', 51_000);
  activateSkill(state, 'blink', 61_000);
  const withCoolingWarp = structuredClone(state);
  assert.equal(changeLastActivation(state, 'warp'), null);
  assert.deepEqual(state, withCoolingWarp);
});
