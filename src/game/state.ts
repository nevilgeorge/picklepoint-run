// Game state machine: title → ready → play ⇄ paused → (dying → ready)* → over.

import { DOTS, PELLETS, key, type Point } from '../shared/board';
import { DOT_POINTS, FRIGHT_TICKS, PAR_TICKS, PIEROGI_POINTS, PLAYER_SPEED, START_LIVES, finalScore } from '../shared/scoring';
import { createChasers, speedOf, stepChaser, type ChaseContext, type Chaser } from './chasers';
import { createPlayer, dist2, setDir, stepPlayer, type Dir, type Player } from './movement';

export type GameState = 'title' | 'ready' | 'play' | 'paused' | 'dying' | 'over';

export interface RunResult {
  won: boolean;
  /** Dots and pierogi, before bonus. */
  points: number;
  bonus: number;
  score: number;
  /** Par-clock ticks left when the run ended. */
  ticksLeft: number;
  /** Play ticks (same counting rule as the par clock). */
  elapsed: number;
  dots: number;
  pierogi: number;
}

/** Hooks the UI implements; the game calls them when something visible changes. */
export interface GameEvents {
  hud(): void;
  timer(): void;
  where(force: boolean): void;
  power(): void;
  banner(text: string | null): void;
  end(result: RunResult): void;
}

const READY_TICKS = 120;
const RESPAWN_READY_TICKS = 90;
const DYING_TICKS = 80;
const TRAIL_LEN = 90;
const HIT_DIST = 13;

export class Game {
  state: GameState = 'title';
  prevState: GameState | null = null;
  /** Countdown for timed states (ready, dying). */
  timer = 0;
  /** Global tick counter, drives animation. */
  T = 0;
  score = 0;
  lives = START_LIVES;
  fright = 0;
  dots = new Map<string, Point>();
  pellets = new Map<string, Point>();
  totalLeft = 0;
  dotsEaten = 0;
  pierogiEaten = 0;
  player: Player = createPlayer();
  chasers: Chaser[] = createChasers();
  trail: Point[] = [];
  /** Par clock: counts down during play and dying only, stops at 0. */
  timeLeft = PAR_TICKS;
  elapsed = 0;
  /** Freezes the whole simulation (Scores modal open) without touching the state machine. */
  frozen = false;

  private readonly ctx: ChaseContext;

  constructor(private readonly events: GameEvents, rng: () => number = Math.random) {
    const game = this;
    this.ctx = {
      get player() { return game.player; },
      get trail() { return game.trail; },
      get fright() { return game.fright; },
      rng,
    };
    this.buildDots();
  }

  buildDots(): void {
    this.dots = new Map(DOTS.map(d => [key(d.x, d.y), { x: d.x, y: d.y }]));
    this.pellets = new Map(PELLETS.map(([x, y]) => [key(x, y), { x, y }]));
    this.totalLeft = this.dots.size + this.pellets.size;
    this.dotsEaten = 0;
    this.pierogiEaten = 0;
  }

  resetActors(): void {
    this.player = createPlayer();
    this.chasers = createChasers();
    this.trail = [];
    this.fright = 0;
  }

  newGame(): void {
    this.score = 0; this.lives = START_LIVES;
    this.buildDots(); this.resetActors();
    this.timeLeft = PAR_TICKS; this.elapsed = 0;
    this.events.hud(); this.events.timer(); this.events.where(true);
    this.state = 'ready'; this.timer = READY_TICKS;
    this.events.banner('READY!');
  }

  setDir(d: Dir): void { setDir(this.player, d); }

  togglePause(): void {
    if (this.state === 'play' || this.state === 'ready') {
      this.prevState = this.state; this.state = 'paused';
      this.events.banner('PAUSED');
    } else if (this.state === 'paused') {
      this.state = this.prevState ?? 'play';
      this.events.banner(this.state === 'play' ? null : 'READY!');
    }
  }

  tick(): void {
    this.T++;
    if (this.frozen) return;
    if (this.state === 'ready') {
      if (--this.timer <= 0) { this.state = 'play'; this.events.banner(null); }
      return;
    }
    if (this.state === 'play' || this.state === 'dying') {
      this.elapsed++;
      if (this.timeLeft > 0) this.timeLeft--;
      if (this.elapsed % 15 === 0) this.events.timer();
    }
    if (this.state === 'dying') {
      if (--this.timer <= 0) {
        if (this.lives <= 0) this.endGame(false);
        else {
          this.resetActors(); this.events.where(true);
          this.state = 'ready'; this.timer = RESPAWN_READY_TICKS; this.events.banner('READY!');
        }
      }
      return;
    }
    if (this.state !== 'play') return;

    const p = this.player;
    p.acc += PLAYER_SPEED;
    while (p.acc >= 1 && this.state === 'play') {
      p.acc -= 1;
      if (stepPlayer(p)) this.eat();
    }
    if (this.state !== 'play') return;
    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();
    if (this.fright > 0) this.fright--;

    for (const c of this.chasers) {
      if (c.wait > 0) { c.wait--; continue; }
      if (c.kind === 'bandit' && --c.modeT <= 0) {
        c.mode = c.mode === 'wander' ? 'charge' : 'wander';
        c.modeT = c.mode === 'charge' ? 150 : 300;
      }
      c.acc += speedOf(c, this.fright);
      while (c.acc >= 1) { c.acc -= 1; stepChaser(c, this.ctx); }
      if (this.fright <= 0 && dist2(c.x, c.y, p.x, p.y) < HIT_DIST * HIT_DIST) { this.loseLife(); return; }
    }
    if (this.T % 6 === 0) this.events.where(false);
    this.events.power();
  }

  private eat(): void {
    const k = key(this.player.x, this.player.y);
    if (this.dots.delete(k)) {
      this.score += DOT_POINTS; this.dotsEaten++; this.totalLeft--;
      this.events.hud();
    }
    if (this.pellets.delete(k)) {
      this.score += PIEROGI_POINTS; this.pierogiEaten++; this.totalLeft--;
      this.fright = FRIGHT_TICKS;
      this.chasers.forEach(c => { if (c.dir) c.dir = { x: -c.dir.x, y: -c.dir.y }; });
      this.events.hud();
    }
    if (this.totalLeft <= 0) this.endGame(true);
  }

  private loseLife(): void {
    this.lives--; this.events.hud();
    this.state = 'dying'; this.timer = DYING_TICKS; this.fright = 0;
    this.events.power();
  }

  private endGame(won: boolean): void {
    this.state = 'over';
    this.events.timer();
    const points = this.score;
    const { bonus, score } = finalScore(points, won, this.timeLeft);
    this.score = score;
    this.events.banner(null); this.events.power();
    this.events.end({
      won, points, bonus, score, ticksLeft: this.timeLeft, elapsed: this.elapsed,
      dots: this.dotsEaten, pierogi: this.pierogiEaten,
    });
  }
}
