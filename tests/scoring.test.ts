import { describe, expect, it } from 'vitest';
import { DOT_COUNT, PIEROGI_COUNT } from '../src/shared/board';
import {
  MAX_SCORE, MIN_CLEAR_MS, PAR_TICKS, bonusFromElapsedMs, bonusFromTicksLeft, clock, finalScore, fmtScore, pointsFor,
} from '../src/shared/scoring';

const ticks = (m: number, s: number): number => (m * 60 + s) * 60;

describe('scoring', () => {
  it('awards 620 for a full clear at 3:58 elapsed', () => {
    const ticksLeft = PAR_TICKS - ticks(3, 58);
    expect(bonusFromTicksLeft(ticksLeft)).toBe(620);
    expect(bonusFromElapsedMs(238_000)).toBe(620);
    expect(finalScore(4820, true, ticksLeft)).toEqual({ bonus: 620, score: 5440 });
  });

  it('rounds partial seconds up', () => {
    expect(bonusFromTicksLeft(1)).toBe(10);
    expect(bonusFromElapsedMs(299_999)).toBe(10);
  });

  it('gives no bonus over par', () => {
    expect(bonusFromTicksLeft(0)).toBe(0);
    expect(bonusFromElapsedMs(320_000)).toBe(0);
    expect(finalScore(4820, true, 0)).toEqual({ bonus: 0, score: 4820 });
  });

  it('gives no bonus on game over', () => {
    expect(finalScore(2480, false, ticks(2, 31))).toEqual({ bonus: 0, score: 2480 });
  });

  it('computes points and MAX_SCORE', () => {
    expect(pointsFor(3, 1)).toBe(80);
    expect(MAX_SCORE).toBe(DOT_COUNT * 10 + PIEROGI_COUNT * 50 + 300 * 10);
    expect(MAX_SCORE).toBe(7750);
    expect(MIN_CLEAR_MS).toBeGreaterThan(60_000);
  });

  it('formats the clock and score', () => {
    expect(clock(PAR_TICKS)).toBe('5:00');
    expect(clock(ticks(2, 31))).toBe('2:31');
    expect(clock(ticks(0, 30) - 30)).toBe('0:30');
    expect(fmtScore(2480)).toBe('002,480');
  });
});
