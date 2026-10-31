// Per-frame draw: water, base layer, dots, pierogi, labels, chasers, player.

import { HGT, RIVER_X, CREEK_Y, W } from '../shared/board';
import type { Game } from '../game/state';
import type { Dir } from '../game/movement';
import { COLORS, PIXEL, rr, type Layers } from './layers';
import { drawPickle, drawPierogi, drawSprite, type Facing } from './sprites';
import { toScreen, type View } from './camera';

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

/** Canvas size in CSS px, the camera view, and whether to draw the minimap. */
export interface Viewport { cssW: number; cssH: number; view: View; minimap: boolean }

const MINI_W = 92;
const MINI_MARGIN = 8;

export function draw(ctx: CanvasRenderingContext2D, dpr: number, game: Game, layers: Layers | null, reduceMotion: boolean, vp: Viewport): void {
  const T = game.T;
  const { view } = vp;
  // Letterbox / out-of-board area reads as open water.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.water; ctx.fillRect(0, 0, vp.cssW, vp.cssH);
  const s = dpr * view.zoom;
  ctx.setTransform(s, 0, 0, s, -view.x * s, -view.y * s);
  drawWater(ctx, T, reduceMotion);
  if (layers) ctx.drawImage(layers.base, 0, 0, W, HGT);
  ctx.fillStyle = COLORS.dot;
  const x0 = view.x - 4, y0 = view.y - 4;
  const x1 = view.x + vp.cssW / view.zoom + 4, y1 = view.y + vp.cssH / view.zoom + 4;
  game.dots.forEach(d => { if (d.x > x0 && d.x < x1 && d.y > y0 && d.y < y1) ctx.fillRect(d.x - 2, d.y - 2, 4, 4); });
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

  if (vp.minimap && layers) drawMinimap(ctx, dpr, game, layers, vp);
}

/** Small whole-board inset (bottom-right) with the player, chasers and the visible area. */
function drawMinimap(ctx: CanvasRenderingContext2D, dpr: number, game: Game, layers: Layers, vp: Viewport): void {
  const m = MINI_W / W;
  const mw = MINI_W, mh = HGT * m;
  const left = vp.cssW - mw - MINI_MARGIN, top = vp.cssH - mh - MINI_MARGIN;
  // Fade out of the way when the pickle is underneath it.
  const p = toScreen(vp.view, game.player.x, game.player.y);
  const under = p.left > left - 16 && p.top > top - 16;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.globalAlpha = under ? 0.3 : 0.85;
  rr(ctx, left - 2, top - 2, mw + 4, mh + 4, 6);
  ctx.fillStyle = COLORS.water; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = '#2E2A5C'; ctx.stroke();
  ctx.drawImage(layers.base, left, top, mw, mh);

  const v = vp.view;
  ctx.strokeStyle = COLORS.wallSoft; ctx.lineWidth = 1;
  const rx = Math.max(0, v.x), ry = Math.max(0, v.y);
  const rw = Math.min(W, v.x + vp.cssW / v.zoom) - rx, rh = Math.min(HGT, v.y + vp.cssH / v.zoom) - ry;
  ctx.strokeRect(left + rx * m + 0.5, top + ry * m + 0.5, rw * m - 1, rh * m - 1);

  const dot = (x: number, y: number, r: number, color: string): void => {
    ctx.beginPath(); ctx.arc(left + x * m, top + y * m, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  };
  game.chasers.forEach(c => dot(c.x, c.y, 2.2, game.fright > 0 ? '#5B7CFF' : '#FF7A6B'));
  dot(game.player.x, game.player.y, 2.8, '#8BD450');
  ctx.restore();
}
