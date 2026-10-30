// Local leaderboard mock for development without a backend. Same ranking rules as the server.

import { BOARD_VERSION } from '../shared/board';
import { LeaderboardError, TOP_N, type LeaderboardClient, type RunSubmission, type ScoreEntry, type SubmitResult } from './types';

const STORAGE_KEY = 'picklepoint-local-scores';
const DELAY_MS = 250;

interface StoredScore {
  id: number;
  initials: string;
  score: number;
  clearMs: number | null;
  createdAt: string;
  boardVersion: string;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** score DESC, createdAt ASC, then insertion order. */
const compareScores = (a: StoredScore, b: StoredScore): number =>
  b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.id - b.id;

const toEntry = (row: StoredScore, rank: number): ScoreEntry => ({
  rank,
  initials: row.initials,
  score: row.score,
  clearMs: row.clearMs,
  createdAt: row.createdAt,
});

export class LocalLeaderboardClient implements LeaderboardClient {
  /** In-memory copy, used as-is when localStorage is unavailable. */
  private memoryScores: StoredScore[] | null = null;

  async top(): Promise<ScoreEntry[]> {
    await sleep(DELAY_MS);
    return this.ranked().slice(0, TOP_N).map((row, i) => toEntry(row, i + 1));
  }

  async submit(run: RunSubmission): Promise<SubmitResult> {
    await sleep(DELAY_MS);
    if (!/^[A-Z]{3}$/.test(run.initials)) throw new LeaderboardError('Initials must be three letters A to Z.', 400);
    if (run.boardVersion !== BOARD_VERSION) throw new LeaderboardError('This score is from an older version of the map.', 400);

    const scores = this.load();
    const row: StoredScore = {
      id: scores.reduce((max, s) => Math.max(max, s.id), 0) + 1,
      initials: run.initials,
      score: run.score,
      clearMs: run.cleared ? run.elapsedMs : null,
      createdAt: new Date().toISOString(),
      boardVersion: run.boardVersion,
    };
    scores.push(row);
    this.save(scores);

    const ranked = this.ranked();
    const rank = ranked.findIndex(s => s.id === row.id) + 1;
    return { rank, entry: toEntry(row, rank), top: ranked.slice(0, TOP_N).map((s, i) => toEntry(s, i + 1)) };
  }

  private ranked(): StoredScore[] {
    return this.load().filter(s => s.boardVersion === BOARD_VERSION).sort(compareScores);
  }

  private load(): StoredScore[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as StoredScore[];
      }
      return this.memoryScores ? [...this.memoryScores] : [];
    } catch {
      return this.memoryScores ? [...this.memoryScores] : [];
    }
  }

  private save(scores: StoredScore[]): void {
    this.memoryScores = scores;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // Storage unavailable (private mode, quota): the in-memory copy still works for this session.
    }
  }
}
