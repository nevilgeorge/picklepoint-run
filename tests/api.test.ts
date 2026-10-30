/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestGet, onRequestPost } from '../functions/api/scores';
import type { D1Database, D1PreparedStatement, D1Result, Env } from '../functions/_lib/d1';
import { BOARD_VERSION, DOT_COUNT } from '../src/shared/board';
import { MAX_SCORE, MIN_CLEAR_MS, bonusFromElapsedMs, pointsFor } from '../src/shared/scoring';
import type { RunSubmission, ScoreEntry, SubmitResult } from '../src/leaderboard/types';

/** D1-shaped adapter over node:sqlite so the handlers' real SQL runs against SQLite. */
class SqliteD1 implements D1Database {
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(query: string): D1PreparedStatement {
    const sqlite = this.sqlite;
    const statement = (params: unknown[]): D1PreparedStatement => ({
      bind: (...values: unknown[]) => statement(values),
      first: async <T>() => (sqlite.prepare(query).get(...(params as SQLInputValue[])) as T | undefined) ?? null,
      all: async <T>(): Promise<D1Result<T>> => ({
        results: sqlite.prepare(query).all(...(params as SQLInputValue[])) as T[],
        success: true,
      }),
      run: async () => {
        sqlite.prepare(query).run(...(params as SQLInputValue[]));
        return { success: true };
      },
    });
    return statement([]);
  }
}

function createEnv(): Env {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
  for (const file of readdirSync(migrationsDir).sort()) sqlite.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  return { DB: new SqliteD1(sqlite), IP_SALT: 'test-salt' };
}

const CLEAR_MS = 238_000; // 3:58

function clearedRun(overrides: Partial<RunSubmission> = {}): RunSubmission {
  const points = pointsFor(DOT_COUNT, 4);
  const bonus = bonusFromElapsedMs(CLEAR_MS);
  return {
    initials: 'PKL', points, bonus, score: points + bonus, cleared: true,
    dots: DOT_COUNT, pierogi: 4, elapsedMs: CLEAR_MS, boardVersion: BOARD_VERSION, ...overrides,
  };
}

function partialRun(dots: number, pierogi: number, overrides: Partial<RunSubmission> = {}): RunSubmission {
  const points = pointsFor(dots, pierogi);
  return {
    initials: 'ABC', points, bonus: 0, score: points, cleared: false,
    dots, pierogi, elapsedMs: 120_000, boardVersion: BOARD_VERSION, ...overrides,
  };
}

let ipCounter = 0;
/** Each call uses a fresh IP unless one is given, so rate limiting doesn't interfere. */
async function post(env: Env, body: unknown, ip = `10.0.0.${++ipCounter}`): Promise<Response> {
  const request = new Request('https://picklepoint.test/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return onRequestPost({ request, env });
}

async function getTop(env: Env): Promise<ScoreEntry[]> {
  const response = await onRequestGet({ request: new Request('https://picklepoint.test/api/scores'), env });
  expect(response.status).toBe(200);
  return ((await response.json()) as { top: ScoreEntry[] }).top;
}

let env: Env;
let clockMs = Date.parse('2026-10-30T12:00:00.000Z');

beforeEach(() => {
  env = createEnv();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clockMs);
});
afterEach(() => {
  vi.useRealTimers();
});

/** Advance the fake clock so created_at values differ. */
function tick(ms = 1000): void {
  clockMs += ms;
  vi.setSystemTime(clockMs);
}

describe('POST /api/scores validation', () => {
  const cases: [string, unknown][] = [
    ['non-JSON body', 'not json'],
    ['missing fields', { initials: 'ABC' }],
    ['lowercase initials', clearedRun({ initials: 'abc' })],
    ['two-letter initials', clearedRun({ initials: 'AB' })],
    ['blocklisted initials', clearedRun({ initials: 'ASS' })],
    ['stale board version', clearedRun({ boardVersion: 'deadbeef' })],
    ['negative dots', partialRun(-1, 0, { points: -10, score: -10 })],
    ['too many dots', partialRun(DOT_COUNT + 1, 0)],
    ['too many pierogi', partialRun(10, 5)],
    ['points mismatch', partialRun(10, 1, { points: 999, score: 999 })],
    ['cleared flag on partial run', partialRun(10, 1, { cleared: true })],
    ['full clear not flagged', clearedRun({ cleared: false, bonus: 0, score: pointsFor(DOT_COUNT, 4) })],
    ['wrong clear bonus', clearedRun({ bonus: 900, score: pointsFor(DOT_COUNT, 4) + 900 })],
    ['bonus on a game over', partialRun(10, 1, { bonus: 100, score: pointsFor(10, 1) + 100 })],
    ['score does not add up', clearedRun({ score: pointsFor(DOT_COUNT, 4) + bonusFromElapsedMs(CLEAR_MS) + 10 })],
    ['impossibly fast clear', clearedRun({
      elapsedMs: MIN_CLEAR_MS - 1000,
      bonus: bonusFromElapsedMs(MIN_CLEAR_MS - 1000),
      score: pointsFor(DOT_COUNT, 4) + bonusFromElapsedMs(MIN_CLEAR_MS - 1000),
    })],
    ['too fast for dots eaten', partialRun(200, 0, { elapsedMs: 200 * 20 - 1 })],
    ['fractional numbers', partialRun(10, 0, { elapsedMs: 1000.5 })],
  ];

  it.each(cases)('rejects %s with 400 and a plain sentence', async (_label, body) => {
    const response = await post(env, body);
    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: string };
    expect(error).toMatch(/^[A-Z].+\.$/);
  });

  it('rejects scores above MAX_SCORE', async () => {
    // A zero-time clear plus the +10 rounding allowance is the only consistent way past MAX_SCORE.
    expect(pointsFor(DOT_COUNT, 4) + bonusFromElapsedMs(0)).toBe(MAX_SCORE);
    const bonus = bonusFromElapsedMs(0) + 10;
    const response = await post(env, clearedRun({ elapsedMs: 0, bonus, score: pointsFor(DOT_COUNT, 4) + bonus }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe('The score is higher than the board allows.');
  });

  it('accepts a clear bonus within ±10 of the server calculation', async () => {
    const bonus = bonusFromElapsedMs(CLEAR_MS) + 10;
    const response = await post(env, clearedRun({ bonus, score: pointsFor(DOT_COUNT, 4) + bonus }));
    expect(response.status).toBe(201);
  });
});

describe('POST /api/scores ranking', () => {
  it('accepts a valid cleared run and returns rank, entry and top', async () => {
    const response = await post(env, clearedRun());
    expect(response.status).toBe(201);
    const result = (await response.json()) as SubmitResult;
    expect(result.rank).toBe(1);
    expect(result.entry).toMatchObject({ rank: 1, initials: 'PKL', score: clearedRun().score, clearMs: CLEAR_MS });
    expect(result.top).toHaveLength(1);
  });

  it('ranks against existing scores and stores clearMs only for clears', async () => {
    await post(env, partialRun(100, 0, { initials: 'LOW' }));
    tick();
    await post(env, partialRun(300, 2, { initials: 'HIG' }));
    tick();
    const response = await post(env, partialRun(200, 1, { initials: 'MID' }));
    const result = (await response.json()) as SubmitResult;
    expect(result.rank).toBe(2);
    expect(result.entry.clearMs).toBeNull();
    expect(result.top.map(e => e.initials)).toEqual(['HIG', 'MID', 'LOW']);
    expect(result.top.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it('orders ties by earlier created_at', async () => {
    await post(env, partialRun(150, 0, { initials: 'FST' }));
    tick();
    const response = await post(env, partialRun(150, 0, { initials: 'SND' }));
    const result = (await response.json()) as SubmitResult;
    expect(result.rank).toBe(2);
    const top = await getTop(env);
    expect(top.map(e => e.initials)).toEqual(['FST', 'SND']);
  });

  it('GET returns at most 10, best first, with a short cache header', async () => {
    for (let i = 1; i <= 12; i++) {
      await post(env, partialRun(i * 10, 0));
      tick();
    }
    const response = await onRequestGet({ request: new Request('https://picklepoint.test/api/scores'), env });
    expect(response.headers.get('Cache-Control')).toContain('max-age=10');
    const { top } = (await response.json()) as { top: ScoreEntry[] };
    expect(top).toHaveLength(10);
    expect(top[0].score).toBe(1200);
    expect(top[9].score).toBe(300);
  });
});

describe('POST /api/scores rate limit', () => {
  it('returns 429 after 5 submissions from one IP in 10 minutes, then recovers', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 5; i++) {
      expect((await post(env, partialRun(10, 0), ip)).status).toBe(201);
      tick();
    }
    const blocked = await post(env, partialRun(10, 0), ip);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: string }).error).toBe(
      'Too many scores from this connection. Try again in a few minutes.',
    );
    expect((await post(env, partialRun(10, 0), '203.0.113.8')).status).toBe(201);

    tick(10 * 60 * 1000);
    expect((await post(env, partialRun(10, 0), ip)).status).toBe(201);
  });
});
