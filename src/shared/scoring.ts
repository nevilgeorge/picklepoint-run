// Scoring constants and formulas. Shared by the client and the leaderboard server.

import { DOT_COUNT, PIEROGI_COUNT, TOTAL_LANE_LENGTH } from './board';

export const TICKS_PER_SEC = 60;
export const MS_PER_TICK = 1000 / TICKS_PER_SEC;

export const DOT_POINTS = 10;
export const PIEROGI_POINTS = 50;
export const BONUS_PER_SEC = 10;

export const PAR_SECS = 300;
export const PAR_TICKS = PAR_SECS * TICKS_PER_SEC;
export const PAR_MS = PAR_SECS * 1000;

/** Pierogi power duration (8 s). */
export const FRIGHT_TICKS = 480;
export const START_LIVES = 3;

export const PLAYER_SPEED = 1.75; // px/tick → 105 px/s
export const PLAYER_PX_PER_SEC = PLAYER_SPEED * TICKS_PER_SEC;

/** Highest possible score: every dot and pierogi plus a full 300 s bonus. */
export const MAX_SCORE = DOT_COUNT * DOT_POINTS + PIEROGI_COUNT * PIEROGI_POINTS + PAR_SECS * BONUS_PER_SEC;

/**
 * Shortest plausible full-clear time: walking every lane once at player speed.
 * A 10% allowance covers dots that sit short of a lane's far end.
 */
export const MIN_CLEAR_MS = Math.floor((TOTAL_LANE_LENGTH / PLAYER_PX_PER_SEC) * 1000 * 0.9);

/** Minimum play time per dot eaten, for non-clearing runs. */
export const MIN_MS_PER_DOT = 20;

export function pointsFor(dots: number, pierogi: number): number {
  return dots * DOT_POINTS + pierogi * PIEROGI_POINTS;
}

/** Client-side clear bonus from par-clock ticks remaining: ceil(ticksLeft / 60) × 10. */
export function bonusFromTicksLeft(ticksLeft: number): number {
  return Math.ceil(Math.max(0, ticksLeft) / TICKS_PER_SEC) * BONUS_PER_SEC;
}

/** Server-side clear bonus from elapsed play time: ceil(max(0, 300000 − elapsedMs) / 1000) × 10. */
export function bonusFromElapsedMs(elapsedMs: number): number {
  return Math.ceil(Math.max(0, PAR_MS - elapsedMs) / 1000) * BONUS_PER_SEC;
}

/** Final score for a finished run. Game overs (not cleared) earn no bonus. */
export function finalScore(points: number, cleared: boolean, ticksLeft: number): { bonus: number; score: number } {
  const bonus = cleared ? bonusFromTicksLeft(ticksLeft) : 0;
  return { bonus, score: points + bonus };
}

export function ticksToMs(ticks: number): number {
  return Math.round(ticks * MS_PER_TICK);
}

/** m:ss from ticks, rounding seconds up (matches the par clock display). */
export function clock(ticks: number): string {
  const s = Math.ceil(ticks / TICKS_PER_SEC);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** m:ss from milliseconds, rounding seconds up. */
export function clockMs(ms: number): string {
  return clock(ms / MS_PER_TICK);
}

/** Zero-padded 6-digit score with a thousands comma, e.g. 002,480. */
export function fmtScore(n: number): string {
  const s = String(Math.min(n, 999999)).padStart(6, '0');
  return s.slice(0, 3) + ',' + s.slice(3);
}
