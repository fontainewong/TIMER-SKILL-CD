import './styles.css';
import { SKILLS, skillById, type SkillId } from './skills.ts';
import { cooldownStatus, createMatch, parseSavedMatch, undoActivation, type Usage } from './state.ts';
import { tapSkill, canCorrectUsage } from './card-interaction.ts';
import { popupBounds } from './popup-layout.ts';
import { ChangeMode } from './change-mode.ts';
import { elapsedMs, formatTime } from './timer.ts';

const STORAGE_KEY = 'idv-match-v1';
let saved: string | null = null;
try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Tracking still works without storage. */ }
let state = parseSavedMatch(saved);
const changeMode = new ChangeMode();
let displayedUsage: Usage | null = null;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="tracker">
    <section class="match-clock" aria-label="比賽計時">
      <div id="timer" class="timer" role="timer" aria-label="比賽經過時間" hidden>00:00</div>
      <button id="start" class="primary">開始比賽</button>
    </section>
    <div id="change-banner" class="change-banner" hidden><span id="change-hint" role="status"></span><button id="cancel-change" class="secondary">取消更變</button></div>
    <section id="skills" class="skills" aria-label="六個輔助技能"></section>
    <footer class="controls"><button id="reset" class="secondary">重設比賽</button></footer>
    <p id="notice" class="notice" aria-live="polite" hidden></p>
  </main>
  <dialog id="details" class="sheet" aria-labelledby="detail-title">
    <div class="sheet-heading"><h2 id="detail-title"></h2><button id="close-detail" class="close" aria-label="關閉技能詳情" autofocus>×</button></div>
    <div class="timestamps"><div><span>使用時間</span><strong id="used-at"></strong></div><div><span>下次可用</span><strong id="ready-at"></strong></div></div>
    <p id="correction-note" class="correction-note" hidden>只能更變或撤銷最近一次使用。</p>
    <div class="detail-actions"><button id="change-activation" class="primary">更變技能</button><button id="detail-undo" class="secondary">撤銷使用</button></div>
  </dialog>
  <dialog id="reset-dialog" class="sheet" aria-labelledby="reset-title">
    <h2 id="reset-title">重設這場比賽？</h2>
    <p class="sheet-note">計時、技能冷卻與使用紀錄將清除，卡片回到預設順序。</p>
    <div class="reset-actions"><button id="cancel-reset" class="secondary" autofocus>繼續比賽</button><button id="confirm-reset" class="primary">確認重設</button></div>
  </dialog>`;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = element<HTMLDivElement>('skills');
const details = element<HTMLDialogElement>('details');
const resetDialog = element<HTMLDialogElement>('reset-dialog');
const start = element<HTMLButtonElement>('start');
const notice = element<HTMLParagraphElement>('notice');
const cards = new Map<SkillId, HTMLButtonElement>();
for (const skill of SKILLS) {
  const card = document.createElement('button');
  card.className = 'skill';
  card.innerHTML = `<span class="water" aria-hidden="true"></span><span class="card-top"><img class="skill-image" src="${import.meta.env.BASE_URL}skills/${skill.id}.PNG" alt="" /><span class="availability"></span></span><span class="skill-name">${skill.name}</span><span class="card-note">初始冷卻 ${skill.initial} 秒</span><span class="card-note">使用後冷卻 ${skill.cooldown} 秒</span>`;
  card.addEventListener('click', () => {
    if (details.open || resetDialog.open) return;
    const changing = changeMode.active;
    const result = changing ? null : tapSkill(state, skill.id);
    const usage = changing ? changeMode.select(state, skill.id) : result?.usage;
    if (!usage) return;
    if (changing || result?.recorded) persist();
    render();
    openDetails(usage);
  });
  cards.set(skill.id, card);
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state })); }
  catch { notice.hidden = false; notice.textContent = '此瀏覽器無法儲存，重新整理後需重新開始。'; }
}

function render() {
  const now = Date.now();
  const running = state.startedAt !== null;
  element('timer').textContent = formatTime(elapsedMs(state.startedAt, now) / 1000);
  element('timer').hidden = !running;
  start.hidden = running;
  element('change-banner').hidden = !changeMode.active;
  element('change-hint').textContent = changeMode.active ? `選擇替代技能 · 使用時間 ${formatTime(changeMode.usedAt!)}` : '';
  state.order.forEach((id, position) => {
    const card = cards.get(id)!;
    if (grid.children[position] !== card) grid.insertBefore(card, grid.children[position] ?? null);
    const status = cooldownStatus(state, id, now);
    const selectable = changeMode.active && changeMode.canSelect(state, id);
    card.disabled = changeMode.active ? !selectable : !running;
    card.classList.toggle('ready', status.available && !changeMode.active);
    card.classList.toggle('change-option', selectable);
    card.classList.toggle('waiting', !running);
    card.classList.toggle('cooling', running && !status.available);
    card.style.setProperty('--water', `${status.fraction * 100}%`);
    card.querySelector('.availability')!.textContent = changeMode.active ? selectable ? '可選擇' : '不可替代' : !running ? '待開始' : status.available ? '可用' : '冷卻中';
    card.setAttribute('aria-label', `${skillById(id).name}，${changeMode.active ? selectable ? '點擊更變技能，保留原使用時間' : '原使用時間尚未可用，無法替代' : !running ? '待開始' : status.available ? '可用，點擊記錄使用' : state.usages.some(usage => usage.skillId === id) ? '冷卻中，點擊查看使用紀錄' : '初始冷卻中，尚無使用紀錄'}`);
  });
  positionPopup();
}

function positionPopup() {
  const secondRow = grid.children[2];
  if (!secondRow) return;
  const bounds = popupBounds(grid.getBoundingClientRect(), secondRow.getBoundingClientRect().top);
  Object.assign(details.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
}

function openDetails(usage: Usage) {
  displayedUsage = usage;
  element('detail-title').textContent = skillById(usage.skillId).name;
  element('used-at').textContent = formatTime(usage.usedAt);
  element('ready-at').textContent = formatTime(usage.readyAt);
  const correctable = canCorrectUsage(state, usage);
  element<HTMLButtonElement>('change-activation').disabled = !correctable;
  element<HTMLButtonElement>('detail-undo').disabled = !correctable;
  element('correction-note').hidden = correctable;
  positionPopup();
  if (!details.open) details.showModal();
}

function undoLast() {
  if (!canCorrectUsage(state, displayedUsage)) return;
  if (!undoActivation(state)) return;
  if (details.open) details.close();
  persist();
  render();
}

start.addEventListener('click', () => {
  if (state.startedAt !== null) return;
  state.startedAt = Date.now();
  persist();
  render();
});
element('detail-undo').addEventListener('click', undoLast);
element('change-activation').addEventListener('click', () => {
  if (!displayedUsage || !changeMode.begin(state, displayedUsage)) return;
  details.close();
  render();
  element('cancel-change').focus();
});
element('cancel-change').addEventListener('click', () => {
  changeMode.cancel();
  render();
  cards.get(state.order[0])!.focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && changeMode.active && !resetDialog.open) {
    changeMode.cancel();
    render();
    cards.get(state.order[0])!.focus();
  }
});
element('close-detail').addEventListener('click', () => details.close());
element('reset').addEventListener('click', () => resetDialog.showModal());
element('cancel-reset').addEventListener('click', () => resetDialog.close());
element('confirm-reset').addEventListener('click', () => {
  state = createMatch();
  changeMode.cancel();
  resetDialog.close();
  persist();
  render();
});
details.addEventListener('click', event => {
  if (event.target === details) {
    const rect = details.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) details.close();
  }
});
document.addEventListener('visibilitychange', render);
window.addEventListener('pageshow', render);
window.addEventListener('resize', render);
render();
setInterval(render, 200);
