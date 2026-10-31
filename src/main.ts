// Boot: fonts → layers → game → UI.

import './styles.css';
import { BOARD_VERSION, HGT, W } from './shared/board';
import { fmtScore, ticksToMs } from './shared/scoring';
import { Game, type GameEvents, type RunResult } from './game/state';
import { DIRS, type DirName } from './game/movement';
import { bindInput } from './game/input';
import { startLoop } from './game/loop';
import { buildLayers, type Layers } from './render/layers';
import { draw, type Viewport } from './render/draw';
import { approach, fitView, followView, toScreen, type View } from './render/camera';
import { createLeaderboardClient } from './leaderboard/client';
import { LeaderboardError, TOP_N, type RunSubmission, type ScoreEntry } from './leaderboard/types';
import { $ } from './ui/dom';
import { cancelTally, loadHigh, renderLives, renderScore, renderTimer, saveHigh, tally } from './ui/hud';
import { locate, renderDotsLeft, renderPower, renderWhere } from './ui/panel';
import { hideOverlay, showBanner, showQualify, showSaved, showShort, showTitle } from './ui/overlays';
import { InitialsEntry, loadInitials, saveInitials } from './ui/initials';
import { ScoresModal } from './ui/leaderboard';

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const DPR = Math.min(2, window.devicePixelRatio || 1);
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const board = $('board');

/** Touch layout (phones): compact header, d-pad under the board, follow camera. */
const touchQuery = window.matchMedia?.('(pointer: coarse) and (max-width: 900px)');
let touch = false;
function applyTouch(): void {
  touch = touchQuery?.matches ?? false;
  document.body.classList.toggle('touch', touch);
}
applyTouch();
touchQuery?.addEventListener('change', applyTouch);

// Canvas backing store tracks its element's size; the camera maps the board into it.
let cssW = W, cssH = HGT;
new ResizeObserver(([entry]) => {
  cssW = Math.max(1, entry.contentRect.width); cssH = Math.max(1, entry.contentRect.height);
  canvas.width = Math.round(cssW * DPR); canvas.height = Math.round(cssH * DPR);
}).observe(canvas);
// The touch layout sizes the play area as "viewport minus header".
const header = document.querySelector('header')!;
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--hdr', `${header.offsetHeight}px`);
}).observe(header);

const pauseBtn = $<HTMLButtonElement>('pauseBtn');
const pauseLabel = pauseBtn.querySelector<HTMLElement>('.lbl')!;
const restartBtn = $<HTMLButtonElement>('restartBtn');
const scoresBtn = $<HTMLButtonElement>('scoresBtn');

const client = createLeaderboardClient();
/** Cached top 10 for the qualification check; null when the leaderboard is unreachable. */
let topCache: ScoreEntry[] | null = null;

let high = loadHigh();
let layers: Layers | null = null;

/** Which end screen is showing, for keyboard routing. */
type EndScreen =
  | { kind: 'none' }
  | { kind: 'qualify'; entry: InitialsEntry; saving: boolean; save(): void; skip(): void }
  | { kind: 'done' };
let endScreen: EndScreen = { kind: 'none' };

const events: GameEvents = {
  hud() {
    renderScore(game.score, high);
    renderLives(game.lives);
    renderDotsLeft(game.totalLeft);
  },
  timer() { renderTimer(game.timeLeft); },
  where(force) { renderWhere(game.player.x, game.player.y, force); },
  power() { renderPower(game.fright); },
  banner: showBanner,
  end: onGameEnd,
};

const game = new Game(events);

function refreshTop(): Promise<void> {
  return client.top().then(t => { topCache = t; }, () => { topCache = null; });
}

function qualifies(score: number, top: readonly ScoreEntry[]): boolean {
  return top.length < TOP_N || score > top[TOP_N - 1].score;
}

function newGame(): void {
  scores.close();
  endScreen = { kind: 'none' };
  cancelTally();
  hideOverlay();
  game.newGame();
  syncPauseBtn();
}

function togglePause(): void {
  game.togglePause();
  syncPauseBtn();
}

function syncPauseBtn(): void {
  const paused = game.state === 'paused';
  pauseLabel.textContent = paused ? 'Resume' : 'Pause';
  pauseBtn.setAttribute('aria-label', pauseLabel.textContent);
  pauseBtn.classList.toggle('is-paused', paused);
}

// ---------- Camera ----------
let view: View = fitView(W, HGT);
let lastFrameAt = 0;
let lastPlayer = { x: game.player.x, y: game.player.y };
let bannerKey = '';

/** Follow the pickle on touch during a run; otherwise show the whole board. */
function updateCamera(now: number): Viewport {
  const frames = lastFrameAt ? (now - lastFrameAt) / (1000 / 60) : 0;
  lastFrameAt = now;
  const { x, y } = game.player;
  const follow = touch && game.state !== 'title' && game.state !== 'over';
  const target = follow ? followView(x, y, cssW, cssH) : fitView(cssW, cssH);
  // Snap on desktop, with reduced motion, and when the pickle teleports (reset after a death).
  const jumped = Math.abs(x - lastPlayer.x) + Math.abs(y - lastPlayer.y) > 40;
  view = !touch || reduceMotion || jumped ? target : approach(view, target, frames);
  lastPlayer = { x, y };
  placeBanner(follow);
  return { cssW, cssH, view, minimap: follow };
}

/** On touch, keep READY!/PAUSED near the pickle (or over Greenpoint Ave when showing the whole board). */
function placeBanner(follow: boolean): void {
  if (!touch) {
    if (bannerKey) { board.style.removeProperty('--banner-left'); board.style.removeProperty('--banner-top'); bannerKey = ''; }
    return;
  }
  const p = follow ? toScreen(view, game.player.x, game.player.y + 60) : toScreen(view, W / 2, 405);
  const left = Math.round(Math.min(cssW - 70, Math.max(70, p.left)));
  const top = Math.round(Math.min(cssH - 20, Math.max(20, p.top)));
  const k = `${left},${top}`;
  if (k === bannerKey) return;
  bannerKey = k;
  board.style.setProperty('--banner-left', `${left}px`);
  board.style.setProperty('--banner-top', `${top}px`);
}

function tallyInto(el: HTMLElement, r: RunResult, prefix: string): void {
  tally(r.won ? r.points : r.score, r.score, high, reduceMotion,
    v => { el.textContent = prefix + fmtScore(v); }, () => events.hud());
}

function onGameEnd(r: RunResult): void {
  if (r.score > high) { high = r.score; saveHigh(high); }
  renderLives(game.lives);
  const street = locate(game.player.x, game.player.y).street;
  const top = topCache;
  if (top && qualifies(r.score, top)) showQualifyScreen(r, top);
  else showShortScreen(r, street, top);
}

function showShortScreen(r: RunResult, street: string, top: ScoreEntry[] | null): void {
  endScreen = { kind: 'done' };
  const view = showShort(r, street, top, newGame, () => scores.open());
  tallyInto(view.final, r, 'FINAL ');
}

function showQualifyScreen(r: RunResult, top: readonly ScoreEntry[]): void {
  const entry = new InitialsEntry(loadInitials());
  const rank = top.filter(e => e.score >= r.score).length + 1;
  const run: Omit<RunSubmission, 'initials'> = {
    points: r.points, bonus: r.bonus, score: r.score, cleared: r.won,
    dots: r.dots, pierogi: r.pierogi, elapsedMs: ticksToMs(r.elapsed), boardVersion: BOARD_VERSION,
  };
  const state: Extract<EndScreen, { kind: 'qualify' }> = {
    kind: 'qualify', entry, saving: false,
    save() {
      if (state.saving) return;
      const initials = entry.value();
      if (!initials) { setError('Enter three letters A to Z.'); entry.focus(); return; }
      state.saving = true;
      view.save.disabled = true; view.skip.disabled = true; view.save.textContent = 'SAVING…';
      setError(null);
      client.submit({ ...run, initials }).then(res => {
        if (endScreen !== state) return;
        saveInitials(initials);
        topCache = res.top;
        endScreen = { kind: 'done' };
        cancelTally(); events.hud();
        showSaved(res.top, res.rank, newGame);
      }, (err: unknown) => {
        if (endScreen !== state) return;
        state.saving = false;
        view.save.disabled = false; view.skip.disabled = false; view.save.textContent = 'SAVE SCORE';
        setError(err instanceof LeaderboardError ? err.message : 'Leaderboard unavailable right now.');
      });
    },
    skip() {
      if (state.saving) return;
      endScreen = { kind: 'done' };
      cancelTally(); events.hud();
      showSaved(topCache ?? [], null, newGame);
    },
  };
  endScreen = state;
  const view = showQualify(r, rank, entry, () => state.save(), () => state.skip());
  const setError = (msg: string | null): void => { view.error.hidden = msg === null; view.error.textContent = msg ?? ''; };
  tallyInto(view.final, r, '');
}

const scores = new ScoresModal(client, {
  getRun: () => ({
    inProgress: game.state !== 'title' && game.state !== 'over',
    score: game.score,
    ticksLeft: game.timeLeft,
  }),
  pickYou(entries) {
    const mine = loadInitials();
    return mine ? entries.find(e => e.initials === mine && e.score === high) : undefined;
  },
  onOpen() { game.frozen = true; scoresBtn.classList.add('pressed'); },
  onClose() { game.frozen = false; scoresBtn.classList.remove('pressed'); },
  onTop(entries) { topCache = entries; },
});

function isButton(t: EventTarget | null): boolean {
  return t instanceof HTMLButtonElement;
}

/** Keys for modals and end screens, before the game sees them. */
function intercept(e: KeyboardEvent): boolean {
  if (scores.handleKey(e)) return true;
  if (endScreen.kind === 'qualify') {
    const s = endScreen;
    if (s.saving) { e.preventDefault(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); s.skip(); return true; }
    if (e.key === 'Enter') {
      // Enter saves, unless focus is on Skip (let the button handle it).
      if (isButton(e.target) && (e.target as HTMLElement).dataset.action === 'skip') return true;
      e.preventDefault(); s.save(); return true;
    }
    if (e.key === ' ' && isButton(e.target)) return true;
    s.entry.handleKey(e);
    return true;
  }
  if (endScreen.kind === 'done' && (e.key === 'Enter' || e.key === ' ') && isButton(e.target)) {
    // A focused end-screen button (PLAY AGAIN, See top 10) handles its own activation.
    return true;
  }
  return false;
}

function onDpad(dir: DirName): void {
  if (scores.isOpen) return;
  if (endScreen.kind === 'qualify') { if (!endScreen.saving) endScreen.entry.move(dir); return; }
  if (game.state === 'title' || game.state === 'over') newGame();
  game.setDir(DIRS[dir]);
}

bindInput({
  intercept,
  direction(dir) {
    if (game.state === 'title') newGame();
    game.setDir(DIRS[dir]);
  },
  pause: togglePause,
  confirm(e) {
    if (game.state === 'title' || game.state === 'over') { e.preventDefault(); newGame(); }
  },
  dpad: onDpad,
});
pauseBtn.addEventListener('click', () => { togglePause(); pauseBtn.blur(); });
restartBtn.addEventListener('click', () => { newGame(); restartBtn.blur(); });
scoresBtn.addEventListener('click', () => scores.toggle());
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') togglePause(); });

function boot(): void {
  layers = buildLayers(DPR);
  events.hud(); events.timer(); events.where(true);
  showTitle(newGame);
  startLoop(() => game.tick(), () => draw(ctx, DPR, game, layers, reduceMotion, updateCamera(performance.now())));
}

void refreshTop();
const fontsReady = document.fonts?.load
  ? Promise.all([
    document.fonts.load(`700 9px 'JetBrains Mono'`),
    document.fonts.load(`600 9px 'JetBrains Mono'`),
    document.fonts.load(`9px 'Press Start 2P'`),
  ])
  : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(boot);
