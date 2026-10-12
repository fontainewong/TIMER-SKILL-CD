import './styles.css';
import { SKILLS, skillById, type SkillId } from './skills.ts';
import { activateSkill, changeLastActivation, cooldownStatus, createMatch, parseSavedMatch, undoActivation, type Usage } from './state.ts';
import { elapsedMs, formatTime } from './timer.ts';

const STORAGE_KEY = 'idv-match-v1';
let saved: string | null = null;
try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Tracking still works without storage. */ }
let state = parseSavedMatch(saved);
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="tracker">
    <header class="heading"><div><p class="eyebrow">IDENTITY V · MATCH COMPANION</p><h1>輔助技能冷卻</h1></div><span class="edition">第五人格</span></header>
    <section class="match-clock" aria-label="比賽計時">
      <div class="clock-label"><span class="dot"></span><span id="match-status">準備開始</span></div>
      <div id="timer" class="timer" role="timer" aria-label="比賽經過時間">00:00</div>
      <button id="start" class="primary">開始比賽 <span aria-hidden="true">→</span></button>
    </section>
    <div class="section-label"><span>輔助技能</span><span id="grid-hint">開始後計算初始冷卻</span></div>
    <section id="skills" class="skills" aria-label="六個輔助技能"></section>
    <footer class="controls"><button id="undo" class="secondary">↶ 撤銷上次使用</button><button id="reset" class="secondary">重設比賽</button></footer>
    <p id="notice" class="notice" aria-live="polite">點擊可用技能，記錄使用時間</p>
  </main>
  <dialog id="details" class="sheet" aria-labelledby="detail-title">
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="sheet-heading"><div><p class="eyebrow">已記錄技能使用</p><h2 id="detail-title"></h2></div><button id="close-detail" class="close" aria-label="關閉技能詳情" autofocus>×</button></div>
    <div class="timestamps"><div><span>使用時間</span><strong id="used-at"></strong></div><div><span>下次可用</span><strong id="ready-at"></strong></div></div>
    <p class="sheet-note">選錯技能？變更技能會保留原本的使用時間。</p>
    <div class="change-actions"><select id="change-skill" aria-label="變更為其他技能"></select><button id="change-activation" class="secondary">變更技能</button></div>
    <button id="detail-undo" class="secondary full">↶ 撤銷這次使用</button>
  </dialog>
  <dialog id="reset-dialog" class="sheet" aria-labelledby="reset-title">
    <div class="sheet-handle" aria-hidden="true"></div><h2 id="reset-title">重設這場比賽？</h2>
    <p class="sheet-note">計時、技能冷卻與使用紀錄將清除，卡片回到預設順序。</p>
    <div class="reset-actions"><button id="cancel-reset" class="secondary" autofocus>繼續比賽</button><button id="confirm-reset" class="primary">確認重設</button></div>
  </dialog>`;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = element<HTMLDivElement>('skills');
const details = element<HTMLDialogElement>('details');
const resetDialog = element<HTMLDialogElement>('reset-dialog');
const start = element<HTMLButtonElement>('start');
const undo = element<HTMLButtonElement>('undo');
const notice = element<HTMLParagraphElement>('notice');
const cards = new Map<SkillId, HTMLButtonElement>();
for (const skill of SKILLS) {
  const card = document.createElement('button');
  card.className = 'skill';
  card.style.setProperty('--accent', skill.color);
  card.innerHTML = `<span class="water" aria-hidden="true"></span><span class="card-top"><span class="symbol" aria-hidden="true">${skill.symbol}</span><span class="availability"></span></span><span class="skill-name">${skill.name}</span><span class="countdown"></span><span class="card-note"></span>`;
  card.addEventListener('click', () => {
    if (details.open || resetDialog.open) return;
    const usage = activateSkill(state, skill.id);
    if (!usage) return;
    persist();
    render();
    openDetails(usage);
  });
  cards.set(skill.id, card);
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state })); }
  catch { notice.textContent = '此瀏覽器無法儲存，重新整理後需重新開始。'; }
}

function render() {
  const now = Date.now();
  const running = state.startedAt !== null;
  element('timer').textContent = formatTime(elapsedMs(state.startedAt, now) / 1000);
  // Keep the bottom sheet below the actual clock, including on short viewports.
  details.style.setProperty('--clock-bottom', `${document.querySelector('.match-clock')!.getBoundingClientRect().bottom + 12}px`);
  element('match-status').textContent = running ? '比賽進行中' : '準備開始';
  app.classList.toggle('running', running);
  start.disabled = running;
  start.textContent = running ? '計時中' : '開始比賽 →';
  undo.disabled = !state.undo;
  element('grid-hint').textContent = running ? '點擊可用技能記錄使用' : '開始後計算初始冷卻';
  state.order.forEach((id, position) => {
    const card = cards.get(id)!;
    if (grid.children[position] !== card) grid.insertBefore(card, grid.children[position] ?? null);
    const status = cooldownStatus(state, id, now);
    const seconds = Math.ceil(status.remaining);
    card.disabled = !status.available;
    card.classList.toggle('ready', status.available);
    card.style.setProperty('--water', `${status.fraction * 100}%`);
    card.querySelector('.availability')!.textContent = !running ? '待開始' : status.available ? '可用' : '冷卻中';
    card.querySelector('.countdown')!.textContent = status.available ? 'READY' : formatTime(seconds);
    card.querySelector('.card-note')!.textContent = !running ? `初始 ${skillById(id).initial} 秒` : status.available ? '點擊記錄使用' : `可用於 ${formatTime(status.readyAt)}`;
    card.setAttribute('aria-label', `${skillById(id).name}，${!running ? '待開始' : status.available ? '可用，點擊記錄使用' : `剩餘 ${seconds} 秒`}`);
  });
}

function openDetails(usage: Usage) {
  element('detail-title').textContent = skillById(usage.skillId).name;
  element('used-at').textContent = formatTime(usage.usedAt);
  element('ready-at').textContent = formatTime(usage.readyAt);
  const selection = element<HTMLSelectElement>('change-skill');
  selection.replaceChildren(...SKILLS.map(skill => {
    const option = new Option(skill.name, skill.id);
    const before = { ...state, ...state.undo };
    const available = cooldownStatus(before, skill.id, state.startedAt! + usage.usedAt * 1000).available;
    option.disabled = !available;
    option.selected = skill.id === usage.skillId;
    return option;
  }));
  if (!details.open) details.showModal();
}

function undoLast() {
  if (!undoActivation(state)) return;
  if (details.open) details.close();
  notice.textContent = '已撤銷使用並還原卡片位置';
  persist();
  render();
}

start.addEventListener('click', () => {
  if (state.startedAt !== null) return;
  state.startedAt = Date.now();
  notice.textContent = '點擊可用技能，記錄使用時間';
  persist();
  render();
});
undo.addEventListener('click', undoLast);
element('detail-undo').addEventListener('click', undoLast);
element('change-activation').addEventListener('click', () => {
  const id = element<HTMLSelectElement>('change-skill').value as SkillId;
  const replacement = changeLastActivation(state, id);
  if (!replacement) return;
  persist();
  render();
  openDetails(replacement);
});
element('close-detail').addEventListener('click', () => details.close());
element('reset').addEventListener('click', () => resetDialog.showModal());
element('cancel-reset').addEventListener('click', () => resetDialog.close());
element('confirm-reset').addEventListener('click', () => {
  state = createMatch();
  resetDialog.close();
  notice.textContent = '已重設，準備開始下一場比賽';
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
