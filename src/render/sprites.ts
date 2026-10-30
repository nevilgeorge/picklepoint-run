// Sprite drawing: chasers (24-unit vector shapes), the pickle and pierogi.

import type { ChaserKind } from '../shared/board';
import { rr, COLORS } from './layers';

type SpriteOp =
  | readonly ['e', number, number, number, number, string] // ellipse cx cy rx ry fill
  | readonly ['p', string, string] // path fill
  | readonly ['s', string, string, number]; // path stroke width

// Same shapes as the design mockups and the side-panel cast SVGs.
export const SPRITES: Record<ChaserKind, readonly SpriteOp[]> = {
  pidge: [['e', 11, 15, 8, 6.5, '#8E9BB0'], ['e', 15.5, 8.5, 4.5, 4.5, '#6F7C95'], ['s', 'M11 11.5c2-1 5-1 6.5 1', '#4FB59A', 2], ['p', 'M19.5 8l3.5 1.2-3.5 1.2z', '#F2A541'], ['e', 16.6, 7.6, 1.4, 1.4, '#fff'], ['e', 17, 7.6, .7, .7, '#111']],
  scraps: [['s', 'M4 16c-3 0-3.5-4-1.5-6', '#E8A0A8', 1.6], ['e', 11, 15, 7.5, 5.5, '#9C6B4E'], ['e', 17.5, 12, 4.2, 4.2, '#9C6B4E'], ['e', 16.4, 7.8, 2.4, 2.4, '#E8A0A8'], ['e', 21.6, 12.6, 1.1, 1.1, '#E8A0A8'], ['e', 18.6, 11, 1.2, 1.2, '#fff'], ['e', 18.9, 11, .6, .6, '#111']],
  gully: [['e', 11, 15, 8, 6, '#F4F4F2'], ['p', 'M5 13c3-3 7-3 10 0-3 2-7 2-10 0z', '#AEB8C6'], ['e', 16.5, 9, 4.2, 4.2, '#F4F4F2'], ['p', 'M20 9l3.5.8-3.5 1.4z', '#F7D046'], ['e', 21.6, 10, .6, .6, '#E0533D'], ['e', 17.6, 8.2, 1, 1, '#111']],
  bandit: [['p', 'M4.5 7L6 2.5 9.5 5.5zM19.5 7L18 2.5 14.5 5.5z', '#6E737D'], ['e', 12, 13, 9, 9, '#8A8F99'], ['p', 'M3.5 12.5c3-2.4 14-2.4 17 0-1.5 2.4-14 2.4-17 0z', '#1C1C22'], ['e', 8.6, 12.4, 1.6, 1.6, '#fff'], ['e', 15.4, 12.4, 1.6, 1.6, '#fff'], ['e', 12, 17.4, 1.5, 1.5, '#1C1C22']],
};

const pathCache = new Map<string, Path2D>();
function p2d(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); pathCache.set(d, p); }
  return p;
}

export function drawSprite(ctx: CanvasRenderingContext2D, kind: ChaserKind, x: number, y: number, faceLeft: boolean, bob: number): void {
  const s = 22 / 24;
  ctx.save();
  ctx.translate(x, y + bob);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.scale(s, s); ctx.translate(-12, -12);
  for (const op of SPRITES[kind]) {
    if (op[0] === 'e') { ctx.beginPath(); ctx.ellipse(op[1], op[2], op[3], op[4], 0, 0, Math.PI * 2); ctx.fillStyle = op[5]; ctx.fill(); }
    else if (op[0] === 'p') { ctx.fillStyle = op[2]; ctx.fill(p2d(op[1])); }
    else { ctx.strokeStyle = op[2]; ctx.lineWidth = op[3]; ctx.lineCap = 'round'; ctx.stroke(p2d(op[1])); }
  }
  ctx.restore();
}

export function drawPierogi(ctx: CanvasRenderingContext2D, x: number, y: number, T: number): void {
  const s = 0.82 + 0.18 * Math.abs(Math.sin(T * 0.07));
  ctx.save(); ctx.translate(x, y + 2); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(255,200,120,.8)'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(0, 2, 9, 9, 0, Math.PI, Math.PI * 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -7, 0, 2); g.addColorStop(0, '#FBEBC2'); g.addColorStop(1, '#E9C27A');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#C9893A';
  for (let a = 1.12; a < 2; a += 0.14) { ctx.beginPath(); ctx.arc(Math.cos(a * Math.PI) * 8, 2 + Math.sin(a * Math.PI) * 8, 1.1, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/** The pickle: `open` is the mouth opening 0..1, `scale` shrinks it while dying. */
export function drawPickle(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Facing, open: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);
  else if (facing === 'up') ctx.rotate(-Math.PI / 2);
  else if (facing === 'down') ctx.rotate(Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(139,212,80,.8)'; ctx.shadowBlur = 12;
  rr(ctx, -11, -8, 22, 16, 8); ctx.fillStyle = '#8BD450'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); rr(ctx, -11, -8, 22, 16, 8); ctx.clip();
  ctx.fillStyle = '#5E9E2E'; ctx.fillRect(-11, 5, 22, 3); ctx.fillRect(8, -8, 3, 16);
  ctx.restore();
  ctx.fillStyle = '#5E9E2E';
  ctx.beginPath(); ctx.arc(-6, -3, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-2.5, 3, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2.5, -3.5, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(3.3, -3.5, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.lane;
  ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(12, 1 - 6 * open); ctx.lineTo(12, 1 + 6 * open); ctx.closePath(); ctx.fill();
  ctx.restore();
}
