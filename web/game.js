// SPDX-License-Identifier: GPL-3.0-only
export const ROUND_MS = 9000;
export const POINTS = 10;

// One complete press/release is one hit. Monotonic time is the authority,
// including when input arrives before the next animation frame.
export class Round {
  constructor() { this.phase = 'idle'; this.score = 0; this.owner = null; this.hits = []; }
  start(now) {
    this.phase = 'playing'; this.started = now; this.deadline = now + ROUND_MS;
    this.score = 0; this.owner = null; this.hits = [];
  }
  remaining(now) { return this.phase === 'idle' ? ROUND_MS : Math.max(0, this.deadline - now); }
  tick(now) {
    if (this.phase === 'playing' && now >= this.deadline) {
      this.phase = 'finished'; this.owner = null; return true;
    }
    return false;
  }
  press(source, now) {
    this.tick(now);
    if (this.phase !== 'playing' || this.owner !== null) return false;
    this.owner = source; return true;
  }
  release(source, now) {
    this.tick(now);
    if (this.phase !== 'playing' || this.owner !== source) return false;
    this.owner = null; this.score += POINTS; this.hits.push(now - this.started); return true;
  }
  cancelPress() { this.owner = null; }
  abort() { this.phase = 'aborted'; this.owner = null; }
  get cps() { return this.hits.length / (ROUND_MS / 1000); }
  get bins() {
    const bins = Array(9).fill(0);
    for (const hit of this.hits) bins[Math.min(8, Math.floor(hit / 1000))]++;
    return bins;
  }
}

export function cleanScores(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(s => s && typeof s.name === 'string' && Number.isInteger(s.value)
    && s.value >= 0 && s.value <= 100000 && s.value % POINTS === 0)
    .map(s => ({ name: s.name.trim().slice(0, 5).toLocaleUpperCase('pl') || 'GRACZ', value: s.value }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
}

export function addScore(scores, entry) {
  const candidate = cleanScores([entry])[0];
  const next = [...cleanScores(scores), ...(candidate ? [candidate] : [])]
    .sort((a, b) => b.value - a.value).slice(0, 10);
  // Stable sorting gives earlier entries priority in a tie. Check the actual
  // candidate, since another round can have the same name and score.
  return { scores: next, accepted: !!candidate && next.includes(candidate) };
}

export function readJSON(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function rank(score) {
  if (score >= 900) return ['LEGENDA KURVIX', 'Galaktyka będzie o tym mówić.'];
  if (score >= 600) return ['KAPITAN', 'Pełna kontrola. Pełna moc.'];
  if (score >= 300) return ['KOSMICZNY KOZAK', 'To już nie są ćwiczenia.'];
  return ['REKRUT', 'Każda legenda zaczyna od pierwszej rundy.'];
}
