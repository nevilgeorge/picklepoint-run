// Chaser AI: per-kind targets, speeds and the 1 px step decision rule.

import { CHASER_STARTS, walk, type ChaserKind, type Point } from '../shared/board';
import { DIR_LIST, DIRS, dist2, type Dir, type Player } from './movement';

export interface Chaser {
  kind: ChaserKind;
  x: number;
  y: number;
  /** Ticks until release. */
  wait: number;
  dir: Dir | null;
  acc: number;
  face: Dir;
  /** Gully's patrol waypoint index. */
  pt: number;
  /** Bandit's mode and ticks left in it. */
  mode: 'wander' | 'charge';
  modeT: number;
}

export interface ChaseContext {
  player: Player;
  /** Player positions over the last ~90 ticks, oldest first. */
  trail: readonly Point[];
  fright: number;
  rng: () => number;
}

const GULLY_PATROL: readonly Point[] = [{ x: 110, y: 70 }, { x: 110, y: 555 }];

export function createChasers(): Chaser[] {
  return CHASER_STARTS.map(c => ({ ...c, dir: null, acc: 0, face: DIRS.left, pt: 0, mode: 'wander', modeT: 240 }));
}

export function targetOf(c: Chaser, ctx: ChaseContext): Point | null {
  const p = ctx.player;
  switch (c.kind) {
    case 'pidge': return ctx.trail[0] || p;
    case 'scraps': { const d = p.face || DIRS.right; return { x: p.x + d.x * 80, y: p.y + d.y * 80 }; }
    case 'gully': {
      if (p.x <= 230) return p;
      const pt = GULLY_PATROL[c.pt];
      if (dist2(c.x, c.y, pt.x, pt.y) < 600) c.pt = 1 - c.pt;
      return GULLY_PATROL[c.pt];
    }
    case 'bandit': return c.mode === 'charge' ? p : null;
  }
}

export function choose(c: Chaser, choices: readonly Dir[], ctx: ChaseContext): Dir {
  if (choices.length === 1) return choices[0];
  const pick = (): Dir => choices[Math.floor(ctx.rng() * choices.length)];
  const p = ctx.player;
  if (ctx.fright > 0) {
    if (ctx.rng() < 0.25) return pick();
    return choices.reduce((best, d) =>
      dist2(c.x + d.x * 8, c.y + d.y * 8, p.x, p.y) > dist2(c.x + best.x * 8, c.y + best.y * 8, p.x, p.y) ? d : best);
  }
  const t = targetOf(c, ctx);
  if (!t || ctx.rng() < 0.12) return pick();
  return choices.reduce((best, d) =>
    dist2(c.x + d.x * 8, c.y + d.y * 8, t.x, t.y) < dist2(c.x + best.x * 8, c.y + best.y * 8, t.x, t.y) ? d : best);
}

/** One 1 px step: no reversing unless forced; keep going down a corridor; choose at junctions. */
export function stepChaser(c: Chaser, ctx: ChaseContext): void {
  const opts = DIR_LIST.filter(d => walk(c.x + d.x, c.y + d.y));
  if (!opts.length) return;
  const cur = c.dir;
  const nonRev = cur ? opts.filter(d => !(d.x === -cur.x && d.y === -cur.y)) : opts;
  const choices = nonRev.length ? nonRev : opts;
  const forwardOK = cur !== null && walk(c.x + cur.x, c.y + cur.y);
  if (!(forwardOK && choices.length === 1)) c.dir = choose(c, choices, ctx);
  const d = c.dir!;
  c.x += d.x; c.y += d.y;
  if (d.x) c.face = d;
}

export function speedOf(c: Chaser, fright: number): number {
  if (fright > 0) return 0.85;
  switch (c.kind) {
    case 'pidge': return 1.4;
    case 'scraps': return 1.5;
    case 'gully': return c.x <= 130 ? 2.0 : 1.2;
    case 'bandit': return c.mode === 'charge' ? 1.9 : 1.2;
  }
}
