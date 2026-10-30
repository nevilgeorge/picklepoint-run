// Board overlays: title screen, READY!/PAUSED banner, end screens.

import { BONUS_PER_SEC, clock, fmtScore, TICKS_PER_SEC } from '../shared/scoring';
import type { RunResult } from '../game/state';
import { $, h } from './dom';

const overlay = $('overlay');
const banner = $('banner');

export function showBanner(text: string | null): void {
  if (text === null) { banner.hidden = true; return; }
  banner.textContent = text; banner.hidden = false;
}

export function hideOverlay(): void {
  overlay.hidden = true;
  overlay.replaceChildren();
}

function show(...children: (Node | null)[]): void {
  overlay.replaceChildren(...children.filter((c): c is Node => c !== null));
  overlay.hidden = false;
}

export function showTitle(onStart: () => void): void {
  const btn = h('button', { class: 'btn primary', type: 'button', text: 'START' });
  btn.addEventListener('click', onStart);
  show(
    h('h2', { text: 'PICKLEPOINT RUN' }),
    h('p', { text: "Eat every dot on Greenpoint's streets. Grab a pierogi and the locals run from you for 8 seconds. Beat the 5:00 par for a time bonus." }),
    btn,
    h('p', { class: 'sub', text: 'Arrow keys or WASD to move · P to pause · Enter to start' }),
  );
}

/** Bonus line for a full clear: the time-bonus arithmetic, or the over-par note. */
export function bonusLine(r: RunResult): string {
  const secsLeft = Math.ceil(r.ticksLeft / TICKS_PER_SEC);
  return r.bonus > 0
    ? `Points ${r.points.toLocaleString('en-US')} + clear bonus ${secsLeft} s × ${BONUS_PER_SEC} = +${r.bonus.toLocaleString('en-US')}`
    : `Points ${r.points.toLocaleString('en-US')} · over the 5:00 par, no time bonus`;
}

/** End screen. Returns the FINAL element so the caller can tally into it. */
export function showEnd(r: RunResult, onPlayAgain: () => void): HTMLElement {
  const btn = h('button', { class: 'btn primary', type: 'button', text: 'PLAY AGAIN' });
  btn.addEventListener('click', onPlayAgain);
  const final = h('p', { class: 'final', text: `FINAL ${fmtScore(r.won ? r.points : r.score)}` });
  show(
    h('h2', { class: r.won ? undefined : 'lose', text: r.won ? 'YOU WIN!' : 'GAME OVER' }),
    h('p', { text: r.won ? `You cleared every street in Greenpoint in ${clock(r.elapsed)}.` : 'The locals got you.' }),
    r.won ? h('p', { class: 'tally', text: bonusLine(r) }) : null,
    final,
    btn,
    h('p', { class: 'sub', text: 'Press Enter to play again' }),
  );
  btn.focus({ preventScroll: true });
  return final;
}
