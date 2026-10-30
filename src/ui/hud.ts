// Header HUD: score, high score, lives.

import { fmtScore } from '../shared/scoring';
import { $ } from './dom';

const HIGH_KEY = 'picklepoint-high';

const els = {
  score: $('score'), high: $('high'), lives: $('lives'),
};

export function loadHigh(): number {
  try { return parseInt(localStorage.getItem(HIGH_KEY) || '0', 10) || 0; } catch { return 0; }
}

export function saveHigh(high: number): void {
  try { localStorage.setItem(HIGH_KEY, String(high)); } catch { /* storage unavailable */ }
}

/** Score and HIGH (max of personal best and the current score). */
export function renderScore(score: number, high: number): void {
  els.score.textContent = fmtScore(score);
  els.high.textContent = fmtScore(Math.max(high, score));
}

let shownLives = -1;
export function renderLives(lives: number): void {
  if (lives === shownLives) return;
  shownLives = lives;
  els.lives.replaceChildren();
  for (let i = 0; i < lives; i++) { const d = document.createElement('div'); d.className = 'life'; els.lives.appendChild(d); }
  els.lives.setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'} left`);
}
