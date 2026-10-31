// Camera: maps the 840×720 logical board onto the canvas element.
// Desktop always shows the whole board ("fit"); the touch layout zooms in and follows the pickle.

import { HGT, W } from '../shared/board';

/** zoom = CSS px per logical px; (x, y) = logical point at the viewport's top-left. */
export interface View { zoom: number; x: number; y: number }

/** Logical width the follow camera aims to show (about half the board). */
export const VISIBLE_W = 440;
/** Fraction of the remaining distance covered per 60 Hz frame while easing. */
export const EASE = 0.15;

export function fitZoom(cssW: number, cssH: number): number {
  return Math.min(cssW / W, cssH / HGT);
}

/** Whole board, centered and letterboxed. At an 840:720 element this is zoom = cssW/840 at (0, 0). */
export function fitView(cssW: number, cssH: number): View {
  const zoom = fitZoom(cssW, cssH);
  return { zoom, x: (W - cssW / zoom) / 2, y: (HGT - cssH / zoom) / 2 };
}

export function followZoom(cssW: number, cssH: number): number {
  return Math.min(1, Math.max(fitZoom(cssW, cssH), cssW / VISIBLE_W));
}

/** Top-left on one axis: center on `p`, clamped to the board; centered if the view is wider than the board. */
function clampAxis(p: number, span: number, size: number): number {
  if (span >= size) return (size - span) / 2;
  return Math.min(size - span, Math.max(0, p - span / 2));
}

/** View centered on (px, py) at follow zoom, kept inside the board. */
export function followView(px: number, py: number, cssW: number, cssH: number): View {
  const zoom = followZoom(cssW, cssH);
  return { zoom, x: clampAxis(px, cssW / zoom, W), y: clampAxis(py, cssH / zoom, HGT) };
}

/**
 * Ease `from` toward `to`. `frames` is elapsed time in 60 Hz frames, so easing speed doesn't
 * depend on the display's refresh rate. Snaps once within a hair of the target.
 */
export function approach(from: View, to: View, frames: number): View {
  const k = 1 - Math.pow(1 - EASE, Math.max(0, frames));
  const lerp = (a: number, b: number): number => a + (b - a) * k;
  const next = { zoom: lerp(from.zoom, to.zoom), x: lerp(from.x, to.x), y: lerp(from.y, to.y) };
  const close = Math.abs(next.zoom - to.zoom) < 1e-3 && Math.abs(next.x - to.x) < 0.25 && Math.abs(next.y - to.y) < 0.25;
  return close ? { ...to } : next;
}

/** Screen (CSS px, relative to the element) position of a logical point. */
export function toScreen(v: View, x: number, y: number): { left: number; top: number } {
  return { left: (x - v.x) * v.zoom, top: (y - v.y) * v.zoom };
}
