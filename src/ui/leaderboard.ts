// Leaderboard table and the header Scores modal.

import { LeaderboardError, type LeaderboardClient, type ScoreEntry } from '../leaderboard/types';
import { clock, clockMs, fmtScore } from '../shared/scoring';
import { $, h } from './dom';

/** Parse an ISO or SQLite (`YYYY-MM-DD HH:MM:SS`, UTC) timestamp. */
function parseDate(s: string): Date {
  return new Date(/[T]/.test(s) ? s : s.replace(' ', 'T') + 'Z');
}

/** `Today`, else `Mon D`. */
export function formatDate(createdAt: string, now: Date = new Date()): string {
  const d = parseDate(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  if (d.toDateString() === now.toDateString()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface TableOptions {
  /** Rank to highlight as the player's just-saved row. */
  highlightRank?: number;
  /** Entry to tag `YOU`. */
  you?: ScoreEntry;
}

export function renderTable(entries: readonly ScoreEntry[], opts: TableOptions = {}): HTMLTableElement {
  const head = h('thead', {}, h('tr', {},
    h('th', { scope: 'col', text: '#' }),
    h('th', { scope: 'col', text: 'NAME' }),
    h('th', { scope: 'col', class: 'num-col', text: 'SCORE' }),
    h('th', { scope: 'col', text: 'CLEAR' }),
    h('th', { scope: 'col', text: 'DATE' }),
  ));
  const body = h('tbody');
  if (!entries.length) {
    body.append(h('tr', { class: 'status' }, h('td', { colspan: 5, text: 'No scores yet. Be the first.' })));
  }
  for (const e of entries) {
    const me = e.rank === opts.highlightRank;
    const you = opts.you === e;
    body.append(h('tr', { class: me ? 'me' : undefined, 'aria-current': me ? 'true' : undefined },
      h('td', { class: 'rank', text: String(e.rank) }),
      h('td', { class: 'name' }, e.initials, you ? h('span', { class: 'you-tag', text: 'YOU' }) : null),
      h('td', { class: 'num-col score', text: fmtScore(e.score) }),
      h('td', { text: e.clearMs === null ? '—' : clockMs(e.clearMs) }),
      h('td', { class: 'date', text: formatDate(e.createdAt) }),
    ));
  }
  return h('table', { class: 'scores' }, head, body);
}

/** Loading or error row in the table body. */
function statusTable(content: Node | string): HTMLTableElement {
  const t = renderTable([]);
  t.tBodies[0].replaceChildren(h('tr', { class: 'status' }, h('td', { colspan: 5 }, content)));
  return t;
}

export interface RunInfo {
  /** A game is in progress (ready, play, paused, dying). */
  inProgress: boolean;
  score: number;
  ticksLeft: number;
}

export interface ScoresModalHooks {
  getRun(): RunInfo;
  /** Player's best entry to tag YOU, chosen from the fetched list. */
  pickYou(entries: readonly ScoreEntry[]): ScoreEntry | undefined;
  onOpen(): void;
  onClose(): void;
  /** Fresh top 10 arrived (refreshes the qualification cache). */
  onTop(entries: ScoreEntry[]): void;
}

const CLOSE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** The Scores modal over the board. Fetches fresh data each time it opens. */
export class ScoresModal {
  private readonly root = $('scoresModal');
  private readonly button = $<HTMLButtonElement>('scoresBtn');
  private requestId = 0;
  private returnFocus: HTMLElement | null = null;
  private tableSlot!: HTMLElement;
  private resumeBtn!: HTMLButtonElement;

  constructor(private readonly client: LeaderboardClient, private readonly hooks: ScoresModalHooks) {
    this.root.addEventListener('click', e => { if (e.target === this.root) this.close(); });
  }

  get isOpen(): boolean { return !this.root.hidden; }

  toggle(): void { if (this.isOpen) this.close(); else this.open(); }

  open(): void {
    if (this.isOpen) return;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const run = this.hooks.getRun();
    this.hooks.onOpen();

    const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close scores' });
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener('click', () => this.close());
    this.resumeBtn = h('button', { type: 'button', class: 'btn primary', text: run.inProgress ? 'RESUME (ESC)' : 'CLOSE (ESC)' });
    this.resumeBtn.addEventListener('click', () => this.close());
    this.tableSlot = h('div', { class: 'table-slot' });

    this.root.replaceChildren(h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'scoresTitle' },
      h('div', { class: 'modal-head' },
        h('h2', { id: 'scoresTitle', class: 'lb-title', text: 'TOP 10' }),
        run.inProgress ? h('span', { class: 'chip', text: 'Game paused' }) : null,
        closeBtn,
      ),
      this.tableSlot,
      run.inProgress
        ? h('p', { class: 'sub', text: `Your run: ${fmtScore(run.score)}, clock stopped at ${clock(run.ticksLeft)}.` })
        : null,
      this.resumeBtn,
    ));
    this.root.hidden = false;
    this.button.setAttribute('aria-pressed', 'true');
    this.resumeBtn.focus({ preventScroll: true });
    this.load();
  }

  close(): void {
    if (!this.isOpen) return;
    this.requestId++;
    this.root.hidden = true;
    this.root.replaceChildren();
    this.button.setAttribute('aria-pressed', 'false');
    this.hooks.onClose();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  /** Keys while open: Esc closes; everything else stays away from the game. Returns true if consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return true; }
    if (e.key.startsWith('Arrow')) e.preventDefault();
    return true;
  }

  private load(): void {
    const id = ++this.requestId;
    this.tableSlot.replaceChildren(statusTable('Loading…'));
    this.client.top().then(entries => {
      if (id !== this.requestId) return;
      this.hooks.onTop(entries);
      this.tableSlot.replaceChildren(renderTable(entries, { you: this.hooks.pickYou(entries) }));
    }).catch((err: unknown) => {
      if (id !== this.requestId) return;
      const retry = h('button', { type: 'button', class: 'btn', text: 'Retry' });
      retry.addEventListener('click', () => this.load());
      const msg = err instanceof LeaderboardError ? err.message : 'Leaderboard unavailable right now.';
      this.tableSlot.replaceChildren(statusTable(h('div', { class: 'lb-error' }, h('span', { text: msg }), retry)));
    });
  }
}
