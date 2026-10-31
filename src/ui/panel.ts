// Side panel: "You're on" street readout, dots left, pierogi power meter.

import { H, V, type HStreet, type VStreet } from '../shared/board';
import { FRIGHT_TICKS } from '../shared/scoring';
import { $ } from './dom';

const els = {
  where: $('where'), whereSub: $('whereSub'), dotsLeft: $('dotsLeft'),
  powerWrap: $('powerWrap'), power: $('power'),
  // Compact copies beside the touch d-pad.
  dotsLeftMini: $('dotsLeftMini'), powerMini: $('powerMini'),
};
const powerMiniBar = els.powerMini.firstElementChild as HTMLElement;

export interface Location { main: string; sub: string; street: string }

function nearest<T>(list: readonly T[], val: (s: T) => number, target: number): T {
  return list.slice().sort((a, b) => Math.abs(val(a) - target) - Math.abs(val(b) - target))[0];
}

/** Street name(s) at a point: an intersection, or one street plus the nearest crossing. */
export function locate(x: number, y: number): Location {
  const h: HStreet | undefined = H.find(s => s.y === y && x >= s.x1 && x <= s.x2);
  const v: VStreet | undefined = V.find(s => s.x === x && y >= s.y1 && y <= s.y2);
  if (h && v) return { main: `${v.n} & ${h.n}`, sub: 'Intersection', street: h.n };
  if (h) {
    const cross = V.filter(s => s.y1 <= h.y && s.y2 >= h.y && s.x >= h.x1 && s.x <= h.x2);
    return { main: h.n, sub: cross.length ? `near ${nearest(cross, s => s.x, x).n}` : '', street: h.n };
  }
  if (v) {
    const cross = H.filter(s => s.x1 <= v.x && s.x2 >= v.x && s.y >= v.y1 && s.y <= v.y2);
    return { main: v.n, sub: cross.length ? `near ${nearest(cross, s => s.y, y).n}` : '', street: v.n };
  }
  return { main: '', sub: '', street: '' };
}

let lastWhere = '';
export function renderWhere(x: number, y: number, force: boolean): void {
  const { main, sub } = locate(x, y);
  const k = main + '|' + sub;
  if (force || k !== lastWhere) { els.where.textContent = main; els.whereSub.textContent = sub; lastWhere = k; }
}

export function renderDotsLeft(n: number): void {
  els.dotsLeft.textContent = `${n} left to eat`;
  els.dotsLeftMini.textContent = `${n} left`;
}

export function renderPower(fright: number): void {
  const on = fright > 0;
  if (els.powerWrap.hidden === on) { els.powerWrap.hidden = !on; els.powerMini.hidden = !on; }
  if (on) {
    const t = `scaleX(${fright / FRIGHT_TICKS})`;
    els.power.style.transform = t; powerMiniBar.style.transform = t;
  }
}
