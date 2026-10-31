// Pure validation of leaderboard submissions.

import { BOARD_VERSION, DOT_COUNT, PIEROGI_COUNT } from '../../src/shared/board';
import {
  MAX_SCORE,
  MIN_CLEAR_MS,
  MIN_MS_PER_DOT,
  BONUS_PER_SEC,
  bonusFromElapsedMs,
  pointsFor,
} from '../../src/shared/scoring';
import type { RunSubmission } from '../../src/leaderboard/types';

/** Three-letter combos we refuse to show on the board. */
export const BLOCKED_INITIALS: ReadonlySet<string> = new Set([
  'ASS', 'CNT', 'COC', 'COK', 'CUM', 'DIC', 'DIK', 'DIX', 'FAG', 'FCK', 'FKN', 'FKU', 'FUC', 'FUK',
  'FUQ', 'HOR', 'JIZ', 'KKK', 'KYS', 'NAZ', 'NGA', 'NGR', 'NIG', 'PNS', 'RAP', 'SEX', 'SHT', 'SLT',
  'TIT', 'VAG', 'WTF', 'XXX',
]);

export type ValidationResult = { ok: true; run: RunSubmission } | { ok: false; error: string };

const fail = (error: string): ValidationResult => ({ ok: false, error });
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Check a parsed request body against every submission rule; returns the typed run or a plain-sentence error. */
export function validateSubmission(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return fail('The score submission was not readable.');
  const b = body as Record<string, unknown>;

  const { initials, points, bonus, score, cleared, dots, pierogi, elapsedMs, boardVersion } = b;
  if (
    typeof initials !== 'string' || typeof cleared !== 'boolean' || typeof boardVersion !== 'string' ||
    !isInt(points) || !isInt(bonus) || !isInt(score) || !isInt(dots) || !isInt(pierogi) || !isInt(elapsedMs)
  ) {
    return fail('The score submission is missing fields.');
  }

  if (!/^[A-Z]{3}$/.test(initials)) return fail('Initials must be three letters A to Z.');
  if (BLOCKED_INITIALS.has(initials)) return fail('Please pick different initials.');
  if (boardVersion !== BOARD_VERSION) return fail('This score is from an older version of the map. Reload the page to play the current one.');
  if (dots < 0 || dots > DOT_COUNT) return fail('The dot count is out of range.');
  if (pierogi < 0 || pierogi > PIEROGI_COUNT) return fail('The pierogi count is out of range.');
  if (points !== pointsFor(dots, pierogi)) return fail('The points do not match the dots and pierogi eaten.');
  if (cleared !== (dots === DOT_COUNT && pierogi === PIEROGI_COUNT)) return fail('The clear flag does not match the dots and pierogi eaten.');
  if (elapsedMs < 0) return fail('The play time is out of range.');

  if (cleared) {
    if (Math.abs(bonus - bonusFromElapsedMs(elapsedMs)) > BONUS_PER_SEC) return fail('The time bonus does not match the clear time.');
  } else if (bonus !== 0) {
    return fail('Only full clears earn a time bonus.');
  }

  if (score !== points + bonus) return fail('The score does not add up.');
  if (score > MAX_SCORE) return fail('The score is higher than the board allows.');
  if (cleared && elapsedMs < MIN_CLEAR_MS) return fail('That clear time is faster than the streets can be walked.');
  if (elapsedMs < dots * MIN_MS_PER_DOT) return fail('That run was too fast for the dots eaten.');

  return {
    ok: true,
    run: { initials, points, bonus, score, cleared, dots, pierogi, elapsedMs, boardVersion },
  };
}

/** SHA-256 of salt + IP, hex-encoded. The raw IP is never stored. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
