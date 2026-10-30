// Header HUD: score, high score, par clock, lives, and the score tally animation.

import { clock, fmtScore } from '../shared/scoring';
import { $ } from './dom';

const HIGH_KEY = 'picklepoint-high';
const LEGACY_HIGH_KEY = 'pickletown-high';
const LOW_CLOCK_TICKS = 30 * 60;
const TALLY_MS = 1400;

const els = {
  score: $('score'), high: $('high'), timer: $('timer'), lives: $('lives'),
};

/** Personal best, migrating the prototype's key if present. */
export function loadHigh(): number {
  try {
    const legacy = parseInt(localStorage.getItem(LEGACY_HIGH_KEY) || '0', 10) || 0;
    const current = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10) || 0;
    if (localStorage.getItem(LEGACY_HIGH_KEY) !== null) {
      localStorage.setItem(HIGH_KEY, String(Math.max(legacy, current)));
      localStorage.removeItem(LEGACY_HIGH_KEY);
    }
    return Math.max(legacy, current);
  } catch {
    return 0;
  }
}

export function saveHigh(high: number): void {
  try { localStorage.setItem(HIGH_KEY, String(high)); } catch { /* storage unavailable */ }
}

/** Score and HIGH (max of personal best and the current score). */
export function renderScore(score: number, high: number): void {
  els.score.textContent = fmtScore(score);
  els.high.textContent = fmtScore(Math.max(high, score));
}

/** PAR m:ss: wall-soft normally, alert at ≤ 0:30, muted at 0:00. */
export function renderTimer(ticksLeft: number): void {
  els.timer.textContent = clock(ticksLeft);
  els.timer.classList.toggle('low', ticksLeft > 0 && ticksLeft <= LOW_CLOCK_TICKS);
  els.timer.classList.toggle('out', ticksLeft <= 0);
}

let shownLives = -1;
export function renderLives(lives: number): void {
  if (lives === shownLives) return;
  shownLives = lives;
  els.lives.replaceChildren();
  for (let i = 0; i < lives; i++) { const d = document.createElement('div'); d.className = 'life'; els.lives.appendChild(d); }
  els.lives.setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'} left`);
}

let tallyId = 0;

/** Cancel any running tally. */
export function cancelTally(): void { tallyId++; }

/**
 * Count up from → to over ~1.4 s (instant with reduced motion), calling onFrame with each value.
 * The header score and HIGH tally along with it.
 */
export function tally(from: number, to: number, high: number, reduceMotion: boolean, onFrame: (v: number) => void, onDone?: () => void): void {
  const id = ++tallyId;
  const start = performance.now();
  const dur = from === to || reduceMotion ? 0 : TALLY_MS;
  const step = (now: number): void => {
    if (id !== tallyId) return;
    const k = dur ? Math.min(1, (now - start) / dur) : 1;
    const v = Math.round(from + (to - from) * k);
    onFrame(v);
    renderScore(v, high);
    if (k < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}
