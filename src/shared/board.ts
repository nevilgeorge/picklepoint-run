// Board data and dot generation. Shared by the client and the leaderboard server,
// so everything here must stay pure and deterministic (no DOM, no font measuring).

export const W = 840;
export const HGT = 720;

/** East River is the strip x < RIVER_X; Newtown Creek is y < CREEK_Y. */
export const RIVER_X = 58;
export const CREEK_Y = 24;

export interface HStreet { n: string; y: number; x1: number; x2: number; w?: number }
export interface VStreet { n: string; x: number; y1: number; y2: number; w?: number; ly: number }
export interface Park { id: number; label: string; x: number; y: number; w: number; h: number; uc?: boolean }
export interface LaneLabel { n: string; x: number; y: number; fs: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

export const H: readonly HStreet[] = [
  { n: 'Commercial St', y: 64, x1: 70, x2: 330 },
  { n: 'Box St', y: 100, x1: 330, x2: 620 },
  { n: 'Clay St', y: 130, x1: 110, x2: 470 },
  { n: 'Dupont St', y: 160, x1: 210, x2: 470 },
  { n: 'Eagle St', y: 190, x1: 70, x2: 470 },
  { n: 'Freeman St', y: 220, x1: 70, x2: 470 },
  { n: 'Green St', y: 250, x1: 70, x2: 470 },
  { n: 'Huron St', y: 280, x1: 70, x2: 470 },
  { n: 'India St', y: 310, x1: 40, x2: 470 },
  { n: 'Java St', y: 340, x1: 70, x2: 470 },
  { n: 'Kent St', y: 370, x1: 70, x2: 470 },
  { n: 'Greenpoint Ave', y: 405, x1: 110, x2: 820, w: 20 },
  { n: 'Milton St', y: 440, x1: 110, x2: 470 },
  { n: 'Noble St', y: 470, x1: 210, x2: 470 },
  { n: 'Oak St', y: 500, x1: 110, x2: 470 },
  { n: 'Calyer St', y: 530, x1: 110, x2: 470 },
  { n: 'Meserole Ave', y: 560, x1: 110, x2: 820 },
  { n: 'Norman Ave', y: 595, x1: 210, x2: 820 },
  { n: 'Nassau Ave', y: 630, x1: 330, x2: 820 },
  { n: 'Driggs Ave', y: 690, x1: 470, x2: 820 },
];

export const V: readonly VStreet[] = [
  { n: 'West St', x: 110, y1: 64, y2: 560, ly: 250 },
  { n: 'Franklin St', x: 210, y1: 64, y2: 595, ly: 290 },
  { n: 'Manhattan Ave', x: 330, y1: 64, y2: 720, w: 18, ly: 210 },
  { n: 'McGuinness Blvd', x: 470, y1: 30, y2: 630, w: 18, ly: 250 },
  { n: 'Russell St', x: 640, y1: 405, y2: 720, ly: 515 },
  { n: 'Monitor St', x: 740, y1: 405, y2: 720, ly: 515 },
];

export const PARKS: readonly Park[] = [
  { id: 1, label: 'BOX ST PARK', x: 196, y: 28, w: 120, h: 24, uc: true },
  { id: 2, label: 'Newtown Barge\nPlayground', x: 121, y: 141, w: 78, h: 38 },
  { id: 3, label: 'WNYC\nTransmitter\nPark', x: 22, y: 381, w: 74, h: 48 },
  { id: 4, label: 'American\nPlayground', x: 121, y: 449, w: 78, h: 40 },
  { id: 5, label: 'Msgr.\nMcGolrick Park', x: 651, y: 641, w: 78, h: 38 },
  { id: 6, label: 'McCarren\nPark ↓', x: 343, y: 641, w: 116, h: 79 },
];

/** Pierogi power-up positions. */
export const PELLETS: readonly (readonly [number, number])[] = [[110, 130], [470, 100], [110, 560], [740, 690]];

export const LANE_LABELS: readonly LaneLabel[] = [
  { n: 'Commercial St', x: 128, y: 64, fs: 9, h: 12 },
  { n: 'Box St', x: 500, y: 100, fs: 9, h: 12 },
  { n: 'GREENPOINT AVE', x: 500, y: 405, fs: 10, h: 14 },
  { n: 'Meserole Ave', x: 500, y: 560, fs: 9, h: 12 },
  { n: 'Norman Ave', x: 500, y: 595, fs: 9, h: 12 },
  { n: 'Nassau Ave', x: 500, y: 630, fs: 9, h: 12 },
  { n: 'Driggs Ave', x: 500, y: 690, fs: 9, h: 12 },
];

/**
 * Street-label pill rectangles, hard-coded so dot generation never depends on font metrics.
 * Derived from the prototype: pill width = measureText(name) + 10 in 700-weight JetBrains Mono
 * (monospace, 0.6 em advance → 5.4 px/char at 9 px, 6 px/char at 10 px), rounded outward.
 * Lane pills first (in LANE_LABELS order), then the rotated vertical pills (in V order).
 */
export const LABEL_RECTS: readonly Rect[] = [
  { x: 128, y: 58, w: 81, h: 12 }, // Commercial St
  { x: 500, y: 94, w: 43, h: 12 }, // Box St
  { x: 500, y: 398, w: 94, h: 14 }, // GREENPOINT AVE
  { x: 500, y: 554, w: 75, h: 12 }, // Meserole Ave
  { x: 500, y: 589, w: 64, h: 12 }, // Norman Ave
  { x: 500, y: 624, w: 64, h: 12 }, // Nassau Ave
  { x: 500, y: 684, w: 64, h: 12 }, // Driggs Ave
  { x: 104, y: 226, w: 12, h: 48 }, // West St
  { x: 204, y: 255, w: 12, h: 70 }, // Franklin St
  { x: 324, y: 169, w: 12, h: 82 }, // Manhattan Ave
  { x: 464, y: 204, w: 12, h: 92 }, // McGuinness Blvd
  { x: 634, y: 483, w: 12, h: 64 }, // Russell St
  { x: 734, y: 483, w: 12, h: 64 }, // Monitor St
];

export const PLAYER_START: Point = { x: 330, y: 340 };

export type ChaserKind = 'pidge' | 'scraps' | 'gully' | 'bandit';
export interface ChaserStart { kind: ChaserKind; x: number; y: number; wait: number }

export const CHASER_STARTS: readonly ChaserStart[] = [
  { kind: 'pidge', x: 640, y: 405, wait: 0 },
  { kind: 'scraps', x: 210, y: 190, wait: 60 },
  { kind: 'gully', x: 110, y: 250, wait: 120 },
  { kind: 'bandit', x: 560, y: 630, wait: 180 },
];

export const onH = (x: number, y: number): boolean => H.some(h => h.y === y && x >= h.x1 && x <= h.x2);
export const onV = (x: number, y: number): boolean => V.some(v => v.x === x && y >= v.y1 && y <= v.y2);
/** A point is walkable if it lies on any street segment (exact integer match on the street's axis). */
export const walk = (x: number, y: number): boolean => onH(x, y) || onV(x, y);

export const key = (x: number, y: number): string => x + '_' + y;

export function inRect(x: number, y: number, r: Rect, pad: number): boolean {
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

/** Generate the dot positions, in deterministic order. Pure: same output on client and server. */
export function generateDots(): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  const add = (x: number, y: number): void => {
    const k = key(x, y);
    if (seen.has(k)) return;
    if (PARKS.some(p => inRect(x, y, p, 4))) return;
    if (LABEL_RECTS.some(r => inRect(x, y, r, 3))) return;
    if (PELLETS.some(p => Math.abs(p[0] - x) < 12 && Math.abs(p[1] - y) < 12)) return;
    if (Math.abs(x - PLAYER_START.x) < 6 && Math.abs(y - PLAYER_START.y) < 6) return;
    seen.add(k);
    out.push({ x, y });
  };
  H.forEach(h => { for (let x = h.x1; x <= h.x2; x += 20) add(x, h.y); });
  V.forEach(v => {
    for (let y = v.y1; y <= v.y2; y += 20) {
      if (H.some(h => h.y !== y && Math.abs(h.y - y) < 10 && v.x >= h.x1 && v.x <= h.x2)) continue;
      add(v.x, y);
    }
  });
  return out;
}

export const DOTS: readonly Point[] = generateDots();
/** Committed dot count; tests/board.test.ts asserts generation still produces exactly this many. */
export const DOT_COUNT = 455;
export const PIEROGI_COUNT = PELLETS.length;

/** Total walkable lane length in px (sum of segment lengths). */
export const TOTAL_LANE_LENGTH =
  H.reduce((s, h) => s + (h.x2 - h.x1), 0) + V.reduce((s, v) => s + (v.y2 - v.y1), 0);

/** FNV-1a 32-bit hash, hex-encoded. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash of all gameplay-relevant board data. Scores are only ranked against the current version. */
export const BOARD_VERSION: string = fnv1a(
  JSON.stringify({ H, V, PARKS, PELLETS, LABEL_RECTS, PLAYER_START, CHASER_STARTS, DOTS }),
);
