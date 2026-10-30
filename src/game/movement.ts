// Directions, the player actor and 1 px movement sub-steps.

import { PLAYER_START, walk } from '../shared/board';

export interface Dir { readonly x: number; readonly y: number }

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const satisfies Record<string, Dir>;

export type DirName = keyof typeof DIRS;
export const DIR_LIST: readonly Dir[] = Object.values(DIRS);

export interface Player {
  x: number;
  y: number;
  dir: Dir | null;
  /** Buffered turn, adopted as soon as it becomes walkable. */
  next: Dir | null;
  face: Dir;
  /** Sub-pixel speed accumulator. */
  acc: number;
  moving: boolean;
}

export function createPlayer(): Player {
  return { x: PLAYER_START.x, y: PLAYER_START.y, dir: null, next: null, face: DIRS.right, acc: 0, moving: false };
}

/** Buffer a new direction; an idle player turns to face it immediately. */
export function setDir(p: Player, d: Dir): void {
  p.next = d;
  if (!p.dir) p.face = d;
}

/** One 1 px sub-step: adopt the buffered turn if walkable, then move or stop. Returns true if moved. */
export function stepPlayer(p: Player): boolean {
  if (p.next && walk(p.x + p.next.x, p.y + p.next.y)) p.dir = p.next;
  if (p.dir && walk(p.x + p.dir.x, p.y + p.dir.y)) {
    p.x += p.dir.x; p.y += p.dir.y; p.face = p.dir; p.moving = true;
    return true;
  }
  p.moving = false;
  return false;
}

export const dist2 = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
