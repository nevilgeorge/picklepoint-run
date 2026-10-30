import { describe, expect, it } from 'vitest';
import { walk } from '../src/shared/board';
import { DIRS, createPlayer, setDir, stepPlayer, type Player } from '../src/game/movement';

function at(x: number, y: number, dir: Player['dir'] = null): Player {
  return { ...createPlayer(), x, y, dir };
}

describe('movement', () => {
  it('takes a buffered turn as soon as the intersection is reached', () => {
    // Heading right along Java St (y=340) toward Franklin St (x=210), with "up" buffered.
    const p = at(207, 340, DIRS.right);
    setDir(p, DIRS.up);
    stepPlayer(p); stepPlayer(p);
    expect(p).toMatchObject({ x: 209, y: 340, dir: DIRS.right });
    stepPlayer(p); // reaches x=210, up not yet walkable from 209
    expect(p).toMatchObject({ x: 210, y: 340 });
    stepPlayer(p);
    expect(p).toMatchObject({ x: 210, y: 339, dir: DIRS.up, face: DIRS.up });
  });

  it('stops at a dead end', () => {
    // India St ends at x=40.
    const p = at(42, 310, DIRS.left);
    expect(stepPlayer(p)).toBe(true);
    expect(stepPlayer(p)).toBe(true);
    expect(p.x).toBe(40);
    expect(stepPlayer(p)).toBe(false);
    expect(p).toMatchObject({ x: 40, y: 310, moving: false });
  });

  it('can always reverse', () => {
    const p = at(250, 340, DIRS.right);
    stepPlayer(p);
    setDir(p, DIRS.left);
    stepPlayer(p);
    expect(p).toMatchObject({ x: 250, dir: DIRS.left });
  });

  it('never moves onto a block', () => {
    // Mid-block on Java St: up/down are not walkable, so the buffered turn waits.
    const p = at(250, 340, DIRS.right);
    setDir(p, DIRS.up);
    for (let i = 0; i < 5; i++) stepPlayer(p);
    expect(p.y).toBe(340);
    expect(walk(p.x, p.y)).toBe(true);
    // An idle player facing a wall does not move.
    const q = at(250, 340);
    setDir(q, DIRS.down);
    expect(stepPlayer(q)).toBe(false);
    expect(q).toMatchObject({ x: 250, y: 340 });
  });
});
