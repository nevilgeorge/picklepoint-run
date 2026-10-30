import { describe, expect, it } from 'vitest';
import { Game, type GameEvents, type RunResult } from '../src/game/state';
import { DIR_LIST } from '../src/game/movement';
import { PAR_TICKS } from '../src/shared/scoring';

function seeded(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function harness(seed = 1): { game: Game; results: RunResult[] } {
  const results: RunResult[] = [];
  const noop = (): void => {};
  const events: GameEvents = { hud: noop, timer: noop, where: noop, power: noop, banner: noop, end: r => results.push(r) };
  return { game: new Game(events, seeded(seed)), results };
}

describe('game state machine', () => {
  it('runs a full game to game over, with the par clock ticking only in play/dying', () => {
    const { game, results } = harness(7);
    const rng = seeded(99);
    game.newGame();
    for (let i = 0; i < 120; i++) game.tick();
    expect(game.state).toBe('play');
    expect(game.timeLeft).toBe(PAR_TICKS); // READY! does not count
    let n = 0;
    while (game.state !== 'over' && n++ < 200_000) {
      if (n % 40 === 0) game.setDir(DIR_LIST[Math.floor(rng() * 4)]);
      game.tick();
    }
    expect(game.state).toBe('over');
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.won).toBe(false);
    expect(r.bonus).toBe(0);
    expect(r.points).toBe(r.dots * 10 + r.pierogi * 50);
    expect(r.elapsed).toBeGreaterThan(0);
  });

  it('stops the clock while paused or frozen', () => {
    const { game } = harness();
    game.newGame();
    for (let i = 0; i < 130; i++) game.tick();
    const t = game.timeLeft;
    game.togglePause();
    for (let i = 0; i < 100; i++) game.tick();
    expect(game.timeLeft).toBe(t);
    game.togglePause();
    game.frozen = true;
    for (let i = 0; i < 100; i++) game.tick();
    expect(game.timeLeft).toBe(t);
    game.frozen = false;
    game.tick();
    expect(game.timeLeft).toBe(t - 1);
  });
});
