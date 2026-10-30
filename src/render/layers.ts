// Static board layers, built once into offscreen canvases.

import { H, HGT, LANE_LABELS, PARKS, RIVER_X, CREEK_Y, V, W } from '../shared/board';

export const COLORS = {
  wall: '#3FD0C9', wallSoft: '#9FF3EC', lane: '#0E0C20', block: '#1B1838', dot: '#FFD58A',
  water: '#10283F', muted: '#B9B3D9',
} as const;
export const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
export const PIXEL = "'Press Start 2P', 'Courier New', monospace";

export interface Layers { base: HTMLCanvasElement; label: HTMLCanvasElement }

/** Rounded-rect path. */
export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function makeLayer(dpr: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = HGT * dpr;
  const x = c.getContext('2d')!;
  x.scale(dpr, dpr);
  return [c, x];
}

export function buildLayers(dpr: number): Layers {
  const lanes: { l: number; t: number; w: number; h: number }[] = [];
  H.forEach(h => { const w = h.w || 14; lanes.push({ l: h.x1 - w / 2, t: h.y - w / 2, w: h.x2 - h.x1 + w, h: w }); });
  V.forEach(v => { const w = v.w || 14; lanes.push({ l: v.x - w / 2, t: v.y1 - w / 2, w, h: v.y2 - v.y1 + w }); });

  const [bc, b] = makeLayer(dpr);
  b.fillStyle = COLORS.block; b.fillRect(RIVER_X, CREEK_Y, W - RIVER_X, HGT - CREEK_Y);
  b.save();
  b.shadowColor = 'rgba(63,208,201,.6)'; b.shadowBlur = 10; b.fillStyle = COLORS.wall;
  lanes.forEach(r => { rr(b, r.l - 2, r.t - 2, r.w + 4, r.h + 4, 10); b.fill(); });
  b.restore();
  b.fillStyle = COLORS.lane;
  lanes.forEach(r => { rr(b, r.l, r.t, r.w, r.h, 8); b.fill(); });

  PARKS.forEach(p => {
    rr(b, p.x, p.y, p.w, p.h, 6);
    b.fillStyle = '#1E5B3B'; b.fill();
    if (p.uc) {
      // under construction: amber hazard stripes
      b.save(); rr(b, p.x, p.y, p.w, p.h, 6); b.clip();
      b.strokeStyle = 'rgba(255,201,77,.4)'; b.lineWidth = 6;
      for (let i = -p.h; i < p.w + p.h; i += 12) { b.beginPath(); b.moveTo(p.x + i, p.y + p.h); b.lineTo(p.x + i + p.h, p.y); b.stroke(); }
      b.restore();
    }
    rr(b, p.x + .75, p.y + .75, p.w - 1.5, p.h - 1.5, 6);
    b.strokeStyle = '#6FD08C'; b.lineWidth = 1.5; b.stroke();
    const lines = p.label.split('\n');
    b.font = `700 8px ${MONO}`; b.fillStyle = '#F2FFF5'; b.textAlign = 'center'; b.textBaseline = 'middle';
    const lh = 9.5, top = p.y + p.h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => b.fillText(ln, p.x + p.w / 2, top + i * lh));
  });

  b.font = `600 9px ${MONO}`; b.fillStyle = COLORS.muted; b.textAlign = 'left'; b.textBaseline = 'middle';
  H.filter(h => h.x2 === 470).forEach(h => b.fillText('◂ ' + h.n, 486, h.y));

  // labels drawn above the dots (dot exclusion uses the hard-coded LABEL_RECTS in shared/board.ts)
  const [lc, l] = makeLayer(dpr);
  l.textBaseline = 'middle';
  LANE_LABELS.forEach(t => {
    l.font = `700 ${t.fs}px ${MONO}`;
    const tw = l.measureText(t.n).width + 10;
    rr(l, t.x, t.y - t.h / 2, tw, t.h, 3); l.fillStyle = COLORS.lane; l.fill();
    l.fillStyle = COLORS.wallSoft; l.textAlign = 'left'; l.fillText(t.n, t.x + 5, t.y + .5);
  });
  V.forEach(v => {
    l.font = `700 9px ${MONO}`;
    const tw = l.measureText(v.n).width + 10;
    l.save(); l.translate(v.x, v.ly); l.rotate(-Math.PI / 2);
    rr(l, -tw / 2, -6, tw, 12, 3); l.fillStyle = COLORS.lane; l.fill();
    l.fillStyle = COLORS.wallSoft; l.textAlign = 'center'; l.fillText(v.n, 0, .5);
    l.restore();
  });
  l.fillStyle = '#7FB8E6';
  l.font = `9px ${PIXEL}`; l.textAlign = 'left';
  l.fillText('NEWTOWN CREEK', 640, 13);
  l.save(); l.translate(29, 600); l.rotate(-Math.PI / 2); l.textAlign = 'center'; l.fillText('EAST RIVER', 0, 0); l.restore();
  l.font = `600 9px ${MONO}`; l.fillText('↑ Pulaski Bridge', 486, 12);
  PARKS.forEach(p => {
    l.beginPath(); l.arc(p.x + 2, p.y + 2, 8, 0, Math.PI * 2);
    l.lineWidth = 4; l.strokeStyle = COLORS.block; l.stroke();
    l.fillStyle = COLORS.dot; l.fill();
    l.fillStyle = COLORS.block; l.font = `700 9px ${MONO}`; l.textAlign = 'center';
    l.fillText(String(p.id), p.x + 2, p.y + 2.5);
  });

  return { base: bc, label: lc };
}
