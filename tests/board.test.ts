import { describe, expect, it } from 'vitest';
import {
  BOARD_VERSION, CHASER_STARTS, DOT_COUNT, DOTS, LABEL_RECTS, PARKS, PELLETS, PIEROGI_COUNT, PLAYER_START,
  generateDots, inRect, walk,
} from '../src/shared/board';

describe('board', () => {
  it('generates a deterministic dot count equal to the committed DOT_COUNT', () => {
    expect(DOTS.length).toBe(DOT_COUNT);
    expect(generateDots()).toEqual(DOTS);
    expect(DOT_COUNT).toBe(455);
    expect(PIEROGI_COUNT).toBe(4);
  });

  it('has no duplicate dots', () => {
    expect(new Set(DOTS.map(d => `${d.x}_${d.y}`)).size).toBe(DOTS.length);
  });

  it('places every dot and pierogi on a street', () => {
    for (const d of DOTS) expect(walk(d.x, d.y), `dot ${d.x},${d.y}`).toBe(true);
    for (const [x, y] of PELLETS) expect(walk(x, y), `pierogi ${x},${y}`).toBe(true);
  });

  it('keeps dots out of parks and label rects', () => {
    for (const d of DOTS) {
      expect(PARKS.some(p => inRect(d.x, d.y, p, 0)), `dot ${d.x},${d.y} in park`).toBe(false);
      expect(LABEL_RECTS.some(r => inRect(d.x, d.y, r, 0)), `dot ${d.x},${d.y} under label`).toBe(false);
    }
  });

  it('starts the player and every chaser on a street', () => {
    expect(walk(PLAYER_START.x, PLAYER_START.y)).toBe(true);
    for (const c of CHASER_STARTS) expect(walk(c.x, c.y), c.kind).toBe(true);
  });

  it('exposes a stable board version hash', () => {
    expect(BOARD_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });
});
