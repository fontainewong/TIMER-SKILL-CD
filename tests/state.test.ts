import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateSkill, changeLastActivation, cooldownStatus, createMatch, parseSavedMatch, undoActivation } from '../src/state.ts';
import { elapsedMs, formatTime } from '../src/timer.ts';
import { ChangeMode } from '../src/change-mode.ts';
import { tapSkill, canCorrectUsage } from '../src/card-interaction.ts';
import { popupBounds } from '../src/popup-layout.ts';

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

test('Change Mode begins at 01:10 and replaces from the grid at 01:12 using 01:00', context => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_000);
  const original = structuredClone(state);
  const mode = new ChangeMode();
  context.mock.method(Date, 'now', () => 71_000);
  assert.equal(mode.begin(state), true);
  assert.equal(mode.active, true);
  assert.equal(mode.usedAt, 60);
  assert.deepEqual(state, original);
  assert.equal(mode.canSelect(state, 'blink'), true);
  assert.equal(mode.canSelect(state, 'warp'), true);
  context.mock.method(Date, 'now', () => 73_000);
  assert.deepEqual(mode.select(state, 'warp'), { skillId: 'warp', usedAt: 60, readyAt: 160 });
  assert.equal(mode.active, false);
  assert.equal(state.usages.length, 1);
  assert.equal(cooldownStatus(state, 'warp').remaining, 88);
  assert.equal(cooldownStatus(state, 'blink').available, true);
  assert.deepEqual(state.order, ['warp', 'blink', 'excitement', 'patroller', 'abnormal', 'teleport']);
  undoActivation(state);
  assert.deepEqual(state.usages, []);
});

test('cancelling Change Mode preserves the original event, cooldowns, order and undo', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  activateSkill(state, 'patroller', 31_000);
  const original = structuredClone(state);
  const mode = new ChangeMode();
  mode.begin(state);
  assert.equal(mode.canSelect(state, 'warp'), false);
  assert.equal(mode.select(state, 'warp'), null);
  assert.equal(mode.active, true);
  mode.cancel();
  assert.equal(mode.active, false);
  assert.equal(mode.select(state, 'patroller'), null);
  assert.deepEqual(state, original);
});

test('Change Mode cannot correct a different event after the original event changes', () => {
  const state = createMatch();
  const mode = new ChangeMode();
  assert.equal(mode.begin(state), false);
  state.startedAt = 1_000;
  activateSkill(state, 'blink', 61_000);
  mode.begin(state);
  activateSkill(state, 'teleport', 71_000);
  const current = structuredClone(state);
  assert.equal(mode.select(state, 'warp'), null);
  assert.deepEqual(state, current);
  mode.cancel();
});

test('tapping a cooling card reopens its event without changing timestamps, cooldown, order or undo', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  const activation = tapSkill(state, 'blink', 61_000)!;
  assert.equal(activation.recorded, true);
  const before = structuredClone(state);
  for (const now of [71_000, 73_000, 100_000]) {
    const reopened = tapSkill(state, 'blink', now)!;
    assert.equal(reopened.recorded, false);
    assert.equal(reopened.usage, activation.usage);
    assert.deepEqual(state, before);
  }
  assert.equal(cooldownStatus(state, 'blink', 73_000).remaining, 138);
  const next = tapSkill(state, 'blink', 211_000)!;
  assert.equal(next.recorded, true);
  assert.equal(next.usage.usedAt, 210);
  assert.equal(state.usages.length, 2);
});

test('Change Mode and Undo after reopening target the original latest activation', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  tapSkill(state, 'blink', 61_000);
  const reopened = tapSkill(state, 'blink', 71_000)!;
  assert.equal(canCorrectUsage(state, reopened.usage), true);
  const mode = new ChangeMode();
  assert.equal(mode.begin(state, reopened.usage), true);
  assert.deepEqual(mode.select(state, 'warp'), { skillId: 'warp', usedAt: 60, readyAt: 160 });
  const correctedPopup = tapSkill(state, 'warp', 73_000)!;
  assert.equal(correctedPopup.recorded, false);
  assert.equal(canCorrectUsage(state, correctedPopup.usage), true);
  assert.equal(undoActivation(state), true);
  assert.deepEqual(state.usages, []);
  assert.deepEqual(state.order, createMatch().order);

  tapSkill(state, 'blink', 81_000);
  const undoPopup = tapSkill(state, 'blink', 91_000)!;
  assert.equal(canCorrectUsage(state, undoPopup.usage), true);
  assert.equal(undoActivation(state), true);
  assert.deepEqual(state.usages, []);
});

test('older cooling records reopen safely; initial cooldowns have no activation to reopen', () => {
  const state = createMatch();
  state.startedAt = 1_000;
  assert.equal(tapSkill(state, 'blink', 31_000), null);
  tapSkill(state, 'blink', 61_000);
  tapSkill(state, 'warp', 71_000);
  const before = structuredClone(state);
  const older = tapSkill(state, 'blink', 73_000)!;
  assert.equal(older.usage.usedAt, 60);
  assert.equal(canCorrectUsage(state, older.usage), false);
  assert.equal(new ChangeMode().begin(state, older.usage), false);
  assert.deepEqual(state, before);
});

test('mobile popup geometry covers only rows two and three inside the grid', () => {
  for (const [viewportWidth, viewportHeight] of [[440, 956], [440, 760], [390, 664], [375, 600]]) {
    const left = 16;
    const top = viewportHeight <= 680 ? 76 : 96;
    const bottom = viewportHeight - 68;
    const rowHeight = (bottom - top - 20) / 3;
    const secondRowTop = top + rowHeight + 10;
    const bounds = popupBounds({ left, top, width: viewportWidth - 32, bottom }, secondRowTop);
    assert.equal(bounds.top, secondRowTop);
    assert.equal(bounds.top + bounds.height, bottom);
    assert.equal(bounds.width, viewportWidth - 32);
    assert.ok(bounds.top > top + rowHeight); // Upper cards and timer remain uncovered.
    assert.ok(bounds.height >= 240); // Compact popup controls fit at these mobile sizes.
    assert.ok(bounds.left + bounds.width <= viewportWidth);
  }
});
