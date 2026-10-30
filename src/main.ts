// Boot: fonts → layers → game → UI.

import './styles.css';
import { HGT, W } from './shared/board';
import { Game, type GameEvents } from './game/state';
import { DIRS } from './game/movement';
import { bindInput } from './game/input';
import { startLoop } from './game/loop';
import { buildLayers, type Layers } from './render/layers';
import { draw } from './render/draw';
import { $ } from './ui/dom';
import { loadHigh, renderLives, renderScore, saveHigh } from './ui/hud';
import { renderDotsLeft, renderPower, renderWhere } from './ui/panel';
import { hideOverlay, showBanner, showEnd, showTitle } from './ui/overlays';

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = W * DPR; canvas.height = HGT * DPR;
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const pauseBtn = $<HTMLButtonElement>('pauseBtn');
const restartBtn = $<HTMLButtonElement>('restartBtn');

let high = loadHigh();
let layers: Layers | null = null;

const events: GameEvents = {
  hud() {
    renderScore(game.score, high);
    renderLives(game.lives);
    renderDotsLeft(game.totalLeft);
  },
  where(force) { renderWhere(game.player.x, game.player.y, force); },
  power() { renderPower(game.fright); },
  banner: showBanner,
  end(result) {
    if (result.score > high) { high = result.score; saveHigh(high); }
    events.hud();
    showEnd(result.won, result.score, newGame);
  },
};

const game = new Game(events);

function newGame(): void {
  pauseBtn.textContent = 'Pause';
  hideOverlay();
  game.newGame();
}

function togglePause(): void {
  game.togglePause();
  pauseBtn.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
}

bindInput({
  intercept: () => false,
  direction(dir) {
    if (game.state === 'title') newGame();
    game.setDir(DIRS[dir]);
  },
  pause: togglePause,
  confirm(e) {
    if (game.state === 'title' || game.state === 'over') { e.preventDefault(); newGame(); }
  },
  dpad(dir) {
    if (game.state === 'title' || game.state === 'over') newGame();
    game.setDir(DIRS[dir]);
  },
});
pauseBtn.addEventListener('click', () => { togglePause(); pauseBtn.blur(); });
restartBtn.addEventListener('click', () => { newGame(); restartBtn.blur(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') togglePause(); });

function boot(): void {
  layers = buildLayers(DPR);
  events.hud(); events.where(true);
  showTitle(newGame);
  startLoop(() => game.tick(), () => draw(ctx, DPR, game, layers, reduceMotion));
}

const fontsReady = document.fonts?.load
  ? Promise.all([
    document.fonts.load(`700 9px 'JetBrains Mono'`),
    document.fonts.load(`600 9px 'JetBrains Mono'`),
    document.fonts.load(`9px 'Press Start 2P'`),
  ])
  : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(boot);
