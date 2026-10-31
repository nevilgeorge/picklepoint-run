// GET /api/scores → top 10; POST /api/scores → submit a run (Cloudflare Pages Function).

import { BOARD_VERSION } from '../../src/shared/board';
import { TOP_N, type ScoreEntry, type SubmitResult } from '../../src/leaderboard/types';
import type { D1Database, PagesFunction } from '../_lib/d1';
import { hashIp, validateSubmission } from '../_lib/validate';

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface ScoreRow {
  id: number;
  initials: string;
  score: number;
  clear_ms: number | null;
  created_at: string;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const toEntry = (row: ScoreRow, rank: number): ScoreEntry => ({
  rank,
  initials: row.initials,
  score: row.score,
  clearMs: row.clear_ms,
  createdAt: row.created_at,
});

/** Top scores for the current board, ordered by score then earliest submission. */
async function fetchTop(db: D1Database): Promise<ScoreEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, initials, score, clear_ms, created_at FROM scores
       WHERE board_version = ?
       ORDER BY score DESC, created_at ASC, id ASC
       LIMIT ?`,
    )
    .bind(BOARD_VERSION, TOP_N)
    .all<ScoreRow>();
  return results.map((row, i) => toEntry(row, i + 1));
}

/** Rank = 1 + number of current-board scores that sort ahead of this row. */
async function rankOf(db: D1Database, row: ScoreRow): Promise<number> {
  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM scores
       WHERE board_version = ?
         AND (score > ? OR (score = ? AND (created_at < ? OR (created_at = ? AND id < ?))))`,
    )
    .bind(BOARD_VERSION, row.score, row.score, row.created_at, row.created_at, row.id)
    .first<{ n: number }>();
  return 1 + (ahead?.n ?? 0);
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    return json({ top: await fetchTop(env.DB) }, 200, { 'Cache-Control': 'public, max-age=10' });
  } catch {
    return json({ error: 'The leaderboard could not be loaded.' }, 500);
  }
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = env.DB;
  // Without a salt, stored IP hashes could be reversed by brute force; refuse rather than store them.
  if (!env.IP_SALT) return json({ error: 'The leaderboard is not accepting scores right now.' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await hashIp(ip, env.IP_SALT);
  const now = new Date();
  const nowIso = now.toISOString();

  // Rate limit counts every attempt, so invalid payloads can't be used to probe the validator freely.
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, windowStart)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= RATE_LIMIT_MAX) {
    return json({ error: 'Too many scores from this connection. Try again in a few minutes.' }, 429);
  }
  await db.prepare('INSERT INTO submissions (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, nowIso).run();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'The score submission was not readable.' }, 400);
  }
  const result = validateSubmission(body);
  if (!result.ok) return json({ error: result.error }, 400);
  const run = result.run;

  const inserted = await db
    .prepare(
      `INSERT INTO scores (initials, score, points, bonus, cleared, clear_ms, board_version, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, initials, score, clear_ms, created_at`,
    )
    .bind(
      run.initials,
      run.score,
      run.points,
      run.bonus,
      run.cleared ? 1 : 0,
      run.cleared ? run.elapsedMs : null,
      run.boardVersion,
      ipHash,
      nowIso,
    )
    .first<ScoreRow>();
  if (!inserted) return json({ error: 'The score could not be saved. Try again.' }, 500);

  const rank = await rankOf(db, inserted);
  const payload: SubmitResult = { rank, entry: toEntry(inserted, rank), top: await fetchTop(db) };
  return json(payload, 201);
};
