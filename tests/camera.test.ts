import { describe, expect, it } from 'vitest';
import { HGT, W } from '../src/shared/board';
import { approach, fitView, followView, followZoom, toScreen, VISIBLE_W } from '../src/render/camera';

describe('camera', () => {
  it('fit view at the desktop aspect is the whole board from the origin', () => {
    expect(fitView(840, 720)).toEqual({ zoom: 1, x: 0, y: 0 });
    const v = fitView(420, 360);
    expect(v.zoom).toBe(0.5);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
  });

  it('fit view letterboxes a tall element, centered vertically', () => {
    const v = fitView(390, 600);
    expect(v.zoom).toBeCloseTo(390 / W);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeLessThan(0);
    expect(v.y + 600 / v.zoom / 2).toBeCloseTo(HGT / 2);
  });

  it('follow zoom on a 390 px phone shows about VISIBLE_W logical px', () => {
    expect(followZoom(390, 520)).toBeCloseTo(390 / VISIBLE_W);
    expect(followZoom(390, 520)).toBeCloseTo(0.886, 2);
    expect(followZoom(1000, 800)).toBe(1);
  });

  it('follow view centers on the player and clamps at board edges', () => {
    const mid = followView(420, 360, 390, 520);
    const c = toScreen(mid, 420, 360);
    expect(c.left).toBeCloseTo(195);
    expect(c.top).toBeCloseTo(260);

    const topLeft = followView(0, 0, 390, 520);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);

    const bottomRight = followView(W, HGT, 390, 520);
    expect(bottomRight.x + 390 / bottomRight.zoom).toBeCloseTo(W);
    expect(bottomRight.y + 520 / bottomRight.zoom).toBeCloseTo(HGT);
  });

  it('approach eases partway, and snaps when close', () => {
    const from = { zoom: 0.5, x: 0, y: 0 };
    const to = { zoom: 1, x: 100, y: 100 };
    const one = approach(from, to, 1);
    expect(one.x).toBeCloseTo(15);
    expect(one.zoom).toBeCloseTo(0.575);
    // Two 60 Hz frames == one 30 Hz frame.
    const twice = approach(approach(from, to, 1), to, 1);
    expect(approach(from, to, 2).x).toBeCloseTo(twice.x);
    expect(approach(from, to, 200)).toEqual(to);
  });
});
