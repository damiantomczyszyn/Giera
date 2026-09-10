// SPDX-License-Identifier: GPL-3.0-only
import { Round, ROUND_MS, cleanScores, readJSON, rank } from './game.js';
import { Voice } from './audio.js';

const $ = id => document.getElementById(id);
const panel = document.querySelector('.game-panel');
const game = new Round();
let storage;
try { storage = window.localStorage; } catch { /* Private/restricted storage: keep playing in memory. */ }
const settingsRaw = readJSON(storage, 'kd.settings.v2', {});
const pref = settingsRaw && typeof settingsRaw === 'object' ? settingsRaw : {};
const settings = { volume: Number.isFinite(pref.volume) ? Math.max(0, Math.min(1, pref.volume)) : .7,
  muted: pref.muted === true, quick: pref.quick === true,
  motion: typeof pref.motion === 'boolean' ? pref.motion : matchMedia('(prefers-reduced-motion: reduce)').matches };
let scores = cleanScores(readJSON(storage, 'kd.scores.v2', readJSON(storage, 'scores', [])));
const statsRaw = readJSON(storage, 'kd.stats.v2', {});
const safeCount = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
const stats = { rounds: safeCount(statsRaw?.rounds), hits: safeCount(statsRaw?.hits),
  best: Math.max(safeCount(statsRaw?.best), scores[0]?.value || 0), last: safeCount(statsRaw?.last) };
let phase = 'idle', introDeadline = 0, operation = 0, saved = false, quickIntro = false;
let playButtonClick = false;
let hudScore = -1, hudPower = -1;
function notice(text) { $('notice').textContent = text; $('notice').hidden = false; }
const voice = new Voice(() => notice('Nie udało się odtworzyć części dźwięków. Gra działa dalej — sprawdź połączenie i dźwięk w przeglądarce.'));
function persist(key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; }
  catch { notice('Przeglądarka blokuje zapis. Wyniki i ustawienia pozostaną tylko do zamknięcia tej strony.'); return false; }
}
function announce(text) { $('announcer').textContent = text; }
function visualPress(pressed) {
  $('character').src = `assets/images/${pressed ? 'active' : 'deactive'}.svg`;
  $('character').classList.toggle('pressed', pressed);
}
function cancelPress() { game.cancelPress(); visualPress(false); }
function renderBoard() {
  $('leaderboard').replaceChildren();
  for (const [i, score] of scores.entries()) {
    const li = document.createElement('li');
    for (const [tag, value] of [['span', String(i + 1).padStart(2,'0')], ['span', score.name], ['b', score.value]]) {
      const element = document.createElement(tag); element.textContent = value; li.append(element);
    }
    $('leaderboard').append(li);
  }
  $('empty-ranking').hidden = scores.length > 0;
  $('personal-best').textContent = String(stats.best).padStart(3,'0');
  $('record-caption').textContent = stats.best ? 'Twój kolejny cel? Jeszcze jedno trafienie.' : 'Pierwsza misja? Zapisz się w historii.';
  $('rounds').textContent = stats.rounds;
  $('total-hits').textContent = stats.hits;
  $('last-score').textContent = stats.rounds ? `${stats.last} PKT` : '—';
}
function renderHUD(now = performance.now()) {
  const remaining = phase === 'playing' ? game.remaining(now) : phase === 'results' ? 0 : ROUND_MS;
  if (hudScore !== game.score) {
    hudScore = game.score;
    $('score').replaceChildren(document.createTextNode(String(game.score).padStart(3,'0')));
    const unit = document.createElement('span'); unit.textContent = 'PKT'; $('score').append(unit);
  }
  $('timer').textContent = (remaining / 1000).toFixed(2);
  $('time-fill').style.transform = `scaleX(${remaining / ROUND_MS})`;
  const power = Math.min(9, Math.floor(game.score / 100));
  if (hudPower !== power) {
    hudPower = power;
    $('power-value').textContent = `${power} / 9`;
    $('hit-bar').setAttribute('aria-label', `Moc: ${power} z 9`);
    [...$('hit-bar').children].forEach((bar, index) => bar.classList.toggle('lit', index < power));
  }
  panel.classList.toggle('urgent', phase === 'playing' && remaining <= 3000);
}
function setPhase(value) {
  phase = value; panel.dataset.phase = value;
  panel.classList.toggle('playing', value === 'playing');
  $('ready-copy').hidden = value !== 'idle';
  $('countdown').hidden = !['loading','intro'].includes(value);
  $('play-callout').hidden = value !== 'playing';
  $('result').hidden = value !== 'results';
  $('interrupted').hidden = value !== 'aborted';
  $('character-wrap').style.opacity = ['results','aborted'].includes(value) ? '0' : '1';
  $('start').disabled = ['intro','loading'].includes(value);
  $('start-label').textContent = ({idle:'NAPRZÓD, ŻOŁNIERZU!',loading:'PRZYGOTOWANIE MISJI…',intro:'CZEKAJ NA SYGNAŁ…',
    playing:'NACIŚNIJ I PUŚĆ!',results:'JESZCZE JEDNA RUNDA',aborted:'ZACZNIJ OD NOWA'})[value];
  $('status-label').textContent = ({idle:'GOTOWY DO AKCJI',loading:'ŁADOWANIE DŹWIĘKÓW',intro:'ODPRAWA PRZED MISJĄ',
    playing:'MISJA W TOKU',results:'MISJA ZAKOŃCZONA',aborted:'PRZERWANO SYGNAŁ'})[value];
  renderHUD();
}
async function startRound() {
  if (!['idle','results','aborted'].includes(phase)) return;
  const current = ++operation;
  voice.stop(); cancelPress(); saved = false; game.score = 0;
  $('save-status').textContent = ''; $('score-form').hidden = false;
  $('notice').hidden = true; $('countdown-value').textContent = '…';
  $('countdown-label').textContent = 'ŁĄCZENIE Z KAPITANEM'; $('skip-intro').hidden = true;
  setPhase('loading');
  // Audio failure can never keep a player on a loading or results screen.
  await Promise.race([voice.unlock(), new Promise(resolve => setTimeout(resolve, 4000))]);
  if (current !== operation || document.hidden) return;
  quickIntro = settings.quick;
  introDeadline = performance.now() + (quickIntro ? 3000 : 8500);
  if (!quickIntro) voice.play('rundaPierwsza');
  $('skip-intro').hidden = quickIntro;
  setPhase('intro'); $('arena').focus({preventScroll:true});
  announce('Przygotuj się. Runda trwa dziewięć sekund.');
}
function beginPlay(now) {
  cancelPress(); voice.stop(); game.start(now); setPhase('playing'); voice.loop();
  announce('Start! Naciskaj i puszczaj spację lub pole gry.');
}
function finish() {
  if (phase !== 'playing') return;
  cancelPress(); voice.stop();
  const record = game.score > stats.best;
  stats.rounds++; stats.hits += game.hits.length; stats.last = game.score;
  stats.best = Math.max(stats.best, game.score); persist('kd.stats.v2', stats);
  const [title, description] = rank(game.score);
  $('result-kicker').textContent = record ? '✳ NOWY REKORD OSOBISTY' : 'MISJA ZAKOŃCZONA';
  $('result-title').textContent = title;
  $('result-score').textContent = game.score;
  $('result-message').textContent = description;
  $('result-hits').textContent = game.hits.length;
  $('result-cps').textContent = game.cps.toFixed(2).replace('.',',');
  $('result-best').textContent = Math.max(...game.bins);
  setPhase('results'); renderBoard();
  voice.sequence(['gameOver', record ? 'najwyzszyWynik' : 'miernyWynik',
    ...(record ? ['wpiszLogin'] : []), 'kapitanDupa', 'sprobujJeszczeRaz']);
  announce(`Koniec rundy. ${game.score} punktów.${record ? ' Nowy rekord!' : ''} Możesz zapisać wynik lub zagrać ponownie.`);
}
function press(source) {
  if (phase !== 'playing') return;
  if (game.press(source, performance.now())) visualPress(true);
  if (game.phase === 'finished') finish();
}
function release(source) {
  if (phase !== 'playing') return;
  if (game.release(source, performance.now())) {
    visualPress(false); renderHUD();
    const pop = $('floating-score'); pop.classList.remove('hit-pop');
    void pop.offsetWidth; pop.classList.add('hit-pop');
  }
  if (game.phase === 'finished') finish();
}
for (const target of [$('arena'), $('start')]) {
  target.addEventListener('pointerdown', e => {
    if (target === $('start')) playButtonClick = phase === 'playing';
    if (phase !== 'playing' || e.button !== 0) return;
    e.preventDefault(); target.setPointerCapture(e.pointerId);
    press(`pointer:${e.pointerId}`);
  });
  target.addEventListener('pointerup', e => {
    if (phase !== 'playing') return;
    e.preventDefault(); release(`pointer:${e.pointerId}`);
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
  });
  target.addEventListener('pointercancel', e => {
    if (game.owner === `pointer:${e.pointerId}`) cancelPress();
  });
  target.addEventListener('lostpointercapture', e => {
    if (game.owner === `pointer:${e.pointerId}`) cancelPress();
  });
  target.addEventListener('contextmenu', e => { if (phase === 'playing') e.preventDefault(); });
}
$('start').addEventListener('click', e => {
  if (playButtonClick && e.detail > 0) { playButtonClick = false; return; }
  playButtonClick = false;
  if (['idle','results','aborted'].includes(phase)) startRound();
});
$('skip-intro').addEventListener('click', () => {
  if (phase !== 'intro') return;
  quickIntro = true; introDeadline = performance.now() + 3000; voice.stop(); $('skip-intro').hidden = true;
});
const isEditing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
document.addEventListener('keydown', e => {
  if (isEditing(e.target)) return;
  if (e.code === 'KeyM' && !e.repeat) { settings.muted = !settings.muted; applySettings(true); }
  if (e.code !== 'Space') return;
  // Native buttons retain their expected keyboard activation outside play.
  if (e.target.closest?.('button,summary,a') && phase !== 'playing') return;
  e.preventDefault();
  if (e.repeat) return;
  if (phase === 'playing') press('keyboard'); else startRound();
});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space' || isEditing(e.target)) return;
  if (phase === 'playing') { e.preventDefault(); release('keyboard'); }
});
function abortRound() {
  if (!['playing','intro','loading'].includes(phase)) return;
  operation++; voice.stop(); cancelPress(); game.abort(); setPhase('aborted');
  announce('Runda przerwana. Zacznij od nowa, gdy będziesz gotowy.');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) abortRound(); });
window.addEventListener('blur', () => { cancelPress(); });
window.addEventListener('pagehide', () => { abortRound(); voice.stop(); });
$('score-form').addEventListener('submit', e => {
  e.preventDefault(); if (phase !== 'results' || saved) return;
  const name = $('name').value.trim().toLocaleUpperCase('pl').slice(0,5);
  if (!name) { $('name').setCustomValidity('Wpisz login.'); $('name').reportValidity(); return; }
  $('name').setCustomValidity('');
  scores = cleanScores([...scores, {name, value:game.score}]);
  const durable = persist('kd.scores.v2', scores); saved = true;
  $('save-status').textContent = durable ? 'Wynik zapisany. Kapitan jest dumny.' : 'Wynik zapisany tylko na czas otwarcia strony.';
  $('score-form').hidden = true; renderBoard(); $('start').focus({preventScroll:true});
});
$('name').addEventListener('input', () => $('name').setCustomValidity(''));
function applySettings(save = false) {
  voice.setVolume(settings.volume, settings.muted);
  $('mute').setAttribute('aria-pressed', String(settings.muted));
  $('mute').setAttribute('aria-label', settings.muted ? 'Włącz dźwięk' : 'Wycisz dźwięk');
  $('sound-icon').textContent = settings.muted ? '×' : '◖))';
  $('volume').value = Math.round(settings.volume * 100);
  $('volume-value').textContent = `${Math.round(settings.volume * 100)}%`;
  $('quick').checked = settings.quick; $('motion').checked = settings.motion;
  document.body.classList.toggle('reduced-motion', settings.motion);
  if (save) persist('kd.settings.v2', settings);
}
$('mute').addEventListener('click', () => { settings.muted = !settings.muted; applySettings(true); });
$('volume').addEventListener('input', e => { settings.volume = Number(e.target.value) / 100; applySettings(true); });
$('quick').addEventListener('change', e => { settings.quick = e.target.checked; applySettings(true); });
$('motion').addEventListener('change', e => { settings.motion = e.target.checked; applySettings(true); });
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await panel.requestFullscreen(); }
  catch { notice('Pełny ekran jest niedostępny w tej przeglądarce.'); }
});
function frame(now) {
  if (phase === 'intro') {
    const left = introDeadline - now;
    $('countdown-label').textContent = left > 3000 ? 'KAPITAN MELDUJE SIĘ' : 'PRZYGOTUJ SIĘ';
    $('countdown-value').textContent = left > 3000 ? 'RUNDA 01' : String(Math.max(1, Math.ceil(left / 1000)));
    $('countdown-value').style.fontSize = left > 3000 ? '64px' : '';
    if (left <= 0) beginPlay(now);
  }
  if (phase === 'playing') {
    if (game.tick(now)) finish(); else renderHUD(now);
  }
  requestAnimationFrame(frame);
}
applySettings(); renderBoard(); setPhase('idle'); requestAnimationFrame(frame);
