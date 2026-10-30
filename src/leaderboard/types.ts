// Leaderboard contract shared by the client adapters and the Pages Function.

export interface ScoreEntry {
  rank: number;
  initials: string;
  score: number;
  /** Clear time in ms for full clears, null otherwise. */
  clearMs: number | null;
  /** ISO 8601 timestamp (UTC). */
  createdAt: string;
}

export interface RunSubmission {
  initials: string; // /^[A-Z]{3}$/
  points: number; // dots*10 + pierogi*50, before bonus
  bonus: number;
  score: number; // points + bonus
  cleared: boolean;
  dots: number;
  pierogi: number;
  elapsedMs: number; // play time (same counting rule as the par clock)
  boardVersion: string;
}

export interface SubmitResult {
  rank: number;
  entry: ScoreEntry;
  top: ScoreEntry[];
}

export interface LeaderboardClient {
  /** Top 10 for the current board version. */
  top(): Promise<ScoreEntry[]>;
  submit(run: RunSubmission): Promise<SubmitResult>;
}

/** Error with a plain-sentence message suitable for showing to the player. */
export class LeaderboardError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'LeaderboardError';
  }
}

export const TOP_N = 10;
