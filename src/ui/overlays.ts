// Board overlays: title screen, READY!/PAUSED banner, end screens (§7.1–7.3).

import type { RunResult } from '../game/state';
import type { ScoreEntry } from '../leaderboard/types';
import { DOT_COUNT, PIEROGI_COUNT } from '../shared/board';
import { BONUS_PER_SEC, clock, fmtScore, TICKS_PER_SEC } from '../shared/scoring';
import { $, h } from './dom';
import type { InitialsEntry } from './initials';
import { renderTable } from './leaderboard';

const overlay = $('overlay');
const banner = $('banner');

/** Touch layout is on (set by main.ts); keyboard hints don't apply there. */
const isTouch = (): boolean => document.body.classList.contains('touch');

export function showBanner(text: string | null): void {
  if (text === null) { banner.hidden = true; return; }
  banner.textContent = text; banner.hidden = false;
}

export function hideOverlay(): void {
  overlay.hidden = true;
  overlay.className = 'overlay';
  overlay.replaceChildren();
}

function show(variant: string, ...children: (Node | null)[]): void {
  overlay.className = `overlay ${variant}`;
  overlay.replaceChildren(...children.filter((c): c is Node => c !== null));
  overlay.hidden = false;
  overlay.scrollTop = 0;
}

function button(text: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = h('button', { class: primary ? 'btn primary' : 'btn', type: 'button', text });
  b.addEventListener('click', onClick);
  return b;
}

export function showTitle(onStart: () => void): void {
  show('title',
    h('h2', { text: 'PICKLEPOINT RUN' }),
    h('p', { text: "Eat every dot on Greenpoint's streets. Grab a pierogi and the locals run from you for 8 seconds. Beat the 5:00 par for a time bonus." }),
    button('START', onStart, true),
    h('p', { class: 'sub', text: isTouch() ? 'Tap the arrows below the map to move' : 'Arrow keys or WASD to move · P to pause · Enter to start' }),
  );
}

/** Bonus line for a full clear: the time-bonus arithmetic, or the over-par note. */
export function bonusLine(r: RunResult): string {
  const secsLeft = Math.ceil(r.ticksLeft / TICKS_PER_SEC);
  return r.bonus > 0
    ? `Points ${r.points.toLocaleString('en-US')} + clear bonus ${secsLeft} s × ${BONUS_PER_SEC} = +${r.bonus.toLocaleString('en-US')}`
    : `Points ${r.points.toLocaleString('en-US')} · over the 5:00 par, no time bonus`;
}

function outcomeHeading(won: boolean, small: boolean): HTMLElement {
  const cls = [small ? 'small' : '', won ? '' : 'lose'].filter(Boolean).join(' ');
  return h('h2', { class: cls || undefined, text: won ? 'YOU WIN!' : 'GAME OVER' });
}

export interface QualifyView {
  /** FINAL score element, for the tally. */
  final: HTMLElement;
  save: HTMLButtonElement;
  skip: HTMLButtonElement;
  error: HTMLElement;
}

/** §7.1 New high score: initials entry. */
export function showQualify(r: RunResult, rank: number, entry: InitialsEntry, onSave: () => void, onSkip: () => void): QualifyView {
  const final = h('span', { text: fmtScore(r.won ? r.points : r.score) });
  const save = button('SAVE SCORE', onSave, true);
  const skip = button('Skip (Esc)', onSkip);
  skip.dataset.action = 'skip';
  const error = h('p', { class: 'lb-error-text', role: 'alert' });
  error.hidden = true;
  show('end qualify',
    outcomeHeading(r.won, true),
    h('h2', { class: 'headline', text: 'NEW HIGH SCORE' }),
    h('p', { class: 'final' }, final, h('span', { class: 'rank-chip', text: `#${rank}` })),
    r.won ? h('p', { class: 'tally', text: bonusLine(r) }) : null,
    h('p', { text: r.won ? `Full clear in ${clock(r.elapsed)}. Enter your initials for the leaderboard.` : 'Enter your initials for the leaderboard.' }),
    entry.el,
    error,
    h('div', { class: 'actions' }, save, skip),
    h('p', { class: 'sub', text: 'Your last initials are filled in for you next time.' }),
  );
  entry.focus();
  return { final, save, skip, error };
}

/** §7.2 Leaderboard after saving (or skipping). */
export function showSaved(top: readonly ScoreEntry[], rank: number | null, onPlayAgain: () => void): void {
  const again = button('PLAY AGAIN', onPlayAgain, true);
  show('end saved',
    h('div', { class: 'lb-head' },
      h('h2', { class: 'lb-title', text: 'TOP 10' }),
      rank !== null ? h('span', { class: 'rank-chip big', text: `YOU'RE #${rank}` }) : null,
    ),
    renderTable(top, { highlightRank: rank ?? undefined }),
    again,
  );
  again.focus({ preventScroll: true });
}

export interface ShortView { final: HTMLElement; seeTop: HTMLButtonElement }

/** §7.3 Did not qualify (or leaderboard unavailable). `top` is null when the leaderboard is down. */
export function showShort(r: RunResult, street: string, top: readonly ScoreEntry[] | null,
  onPlayAgain: () => void, onSeeTop: () => void): ShortView {
  const final = h('p', { class: 'final', text: `FINAL ${fmtScore(r.won ? r.points : r.score)}` });
  const ate = `You ate ${r.dots} of ${DOT_COUNT} dots and ${r.pierogi} of ${PIEROGI_COUNT} pierogi.`
    + (r.won ? '' : ' Time bonus applies only to full clears.');
  let card: HTMLElement;
  if (top && top.length) {
    const tenth = top[top.length - 1].score;
    const short = Math.max(1, tenth - r.score);
    const bar = h('div');
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, r.score / Math.max(1, tenth)))})`;
    card = h('div', { class: 'short-card' },
      h('div', { class: 'short-row' },
        h('b', { text: `${short.toLocaleString('en-US')} points short of the top 10` }),
        h('span', { text: `#10 is ${tenth.toLocaleString('en-US')}` }),
      ),
      h('div', { class: 'meter short-meter' }, bar),
      h('p', { text: ate }),
    );
  } else {
    card = h('div', { class: 'short-card' }, h('b', { text: 'Leaderboard unavailable right now.' }), h('p', { text: ate }));
  }
  const again = button('PLAY AGAIN', onPlayAgain, true);
  const seeTop = button('See top 10', onSeeTop);
  show('end short',
    outcomeHeading(r.won, false),
    h('p', {
      text: r.won
        ? `You cleared every street in Greenpoint in ${clock(r.elapsed)}.`
        : street ? `The locals got you on ${street}.` : 'The locals got you.',
    }),
    r.won ? h('p', { class: 'tally', text: bonusLine(r) }) : null,
    final,
    card,
    h('div', { class: 'actions' }, again, seeTop),
    h('p', { class: 'sub', text: isTouch() ? 'No initials needed.' : 'No initials needed. Press Enter to play again.' }),
  );
  again.focus({ preventScroll: true });
  return { final, seeTop };
}
