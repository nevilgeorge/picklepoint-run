// Per-frame draw: water, base layer, dots, pierogi, labels, chasers, player.

import { HGT, RIVER_X, CREEK_Y, W } from '../shared/board';
import type { Game } from '../game/state';
import type { Dir } from '../game/movement';
import { COLORS, PIXEL, type Layers } from './layers';
import { drawPickle, drawPierogi, drawSprite, type Facing } from './sprites';

const FLASH_TICKS = 120;

function facingOf(d: Dir): Facing {
  if (d.x < 0) return 'left';
  if (d.y < 0) return 'up';
  if (d.y > 0) return 'down';
  return 'right';
}

function drawWater(ctx: CanvasRenderingContext2D, T: number, reduceMotion: boolean): void {
  ctx.fillStyle = COLORS.water; ctx.fillRect(0, 0, W, HGT);
  ctx.fillStyle = 'rgba(130,200,255,.14)';
  const off = reduceMotion ? 0 : (T * 0.25) % 10;
  for (let y = off; y < HGT; y += 10) ctx.fillRect(0, y, RIVER_X, 1);
  for (let y = off - 10; y < CREEK_Y; y += 10) if (y >= 0) ctx.fillRect(RIVER_X, y, W - RIVER_X, 1);
}

export function draw(ctx: CanvasRenderingContext2D, dpr: number, game: Game, layers: Layers | null, reduceMotion: boolean): void {
  const T = game.T;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWater(ctx, T, reduceMotion);
  if (layers) ctx.drawImage(layers.base, 0, 0, W, HGT);
  ctx.fillStyle = COLORS.dot;
  game.dots.forEach(d => ctx.fillRect(d.x - 2, d.y - 2, 4, 4));
  game.pellets.forEach(p => drawPierogi(ctx, p.x, p.y, T));
  if (layers) ctx.drawImage(layers.label, 0, 0, W, HGT);

  const dying = game.state === 'dying';
  const fright = game.fright;
  const flashing = fright > 0 && fright < FLASH_TICKS && Math.floor(T / 8) % 2 === 0;
  game.chasers.forEach((c, i) => {
    const bob = reduceMotion ? 0 : Math.sin(T * 0.25 + i) * 1.2;
    ctx.save();
    if (dying) ctx.globalAlpha = 0.5;
    drawSprite(ctx, c.kind, c.x, c.y, c.face.x < 0, bob);
    ctx.restore();
    if (fright > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = flashing ? '#FFFFFF' : '#5B7CFF';
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#F3F0FF'; ctx.font = `8px ${PIXEL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', c.x + 9, c.y - 11 + bob);
    }
  });

  const p = game.player;
  const scale = dying ? Math.max(0, game.timer / 80) : 1;
  const open = p.moving && game.state === 'play' ? Math.abs(Math.sin(T * 0.35)) : 0.35;
  drawPickle(ctx, p.x, p.y, facingOf(p.face), open, scale);
}
