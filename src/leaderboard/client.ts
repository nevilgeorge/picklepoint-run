// Leaderboard client: HTTP implementation plus a factory that falls back to the local mock.

import { LocalLeaderboardClient } from './local';
import { LeaderboardError, type LeaderboardClient, type RunSubmission, type ScoreEntry, type SubmitResult } from './types';

export * from './types';

const TIMEOUT_MS = 8000;
const UNAVAILABLE = 'Leaderboard unavailable right now.';

/** Talks to the Pages Function at `endpoint` (e.g. `/api/scores`). */
export class HttpLeaderboardClient implements LeaderboardClient {
  constructor(private readonly endpoint: string) {}

  async top(): Promise<ScoreEntry[]> {
    const body = await this.request<{ top: ScoreEntry[] }>({ method: 'GET', cache: 'no-store' });
    return body.top;
  }

  submit(run: RunSubmission): Promise<SubmitResult> {
    return this.request<SubmitResult>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(run),
    });
  }

  private async request<T>(init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(this.endpoint, { ...init, signal: controller.signal });
    } catch {
      throw new LeaderboardError(UNAVAILABLE);
    } finally {
      clearTimeout(timeoutId);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body; handled below.
    }
    if (!response.ok) {
      const serverMessage = (body as { error?: unknown } | null)?.error;
      throw new LeaderboardError(typeof serverMessage === 'string' ? serverMessage : UNAVAILABLE, response.status);
    }
    if (body === null) throw new LeaderboardError(UNAVAILABLE, response.status);
    return body as T;
  }
}

/** HTTP client when VITE_LEADERBOARD_URL is set, otherwise the localStorage mock. */
export function createLeaderboardClient(): LeaderboardClient {
  const endpoint = import.meta.env.VITE_LEADERBOARD_URL as string | undefined;
  return endpoint ? new HttpLeaderboardClient(endpoint) : new LocalLeaderboardClient();
}
