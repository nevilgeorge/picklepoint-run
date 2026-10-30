// Board overlays: title screen, READY!/PAUSED banner, end screens.

import { fmtScore } from '../shared/scoring';
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

function show(...children: Node[]): void {
  overlay.replaceChildren(...children);
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

export function showEnd(won: boolean, score: number, onPlayAgain: () => void): void {
  const btn = h('button', { class: 'btn primary', type: 'button', text: 'PLAY AGAIN' });
  btn.addEventListener('click', onPlayAgain);
  show(
    h('h2', { class: won ? undefined : 'lose', text: won ? 'YOU WIN!' : 'GAME OVER' }),
    h('p', { text: won ? 'You cleared every street in Greenpoint.' : 'The locals got you.' }),
    h('p', { class: 'final', text: `FINAL ${fmtScore(score)}` }),
    btn,
    h('p', { class: 'sub', text: 'Press Enter to play again' }),
  );
  btn.focus({ preventScroll: true });
}
