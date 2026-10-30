// Keyboard and on-screen d-pad input.

import type { DirName } from './movement';

export const KEYMAP: Readonly<Record<string, DirName>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

export interface InputHandlers {
  /** Return true to consume the key before the game sees it (end screens, modals). */
  intercept(e: KeyboardEvent): boolean;
  direction(dir: DirName): void;
  pause(): void;
  /** Enter / Space. */
  confirm(e: KeyboardEvent): void;
  dpad(dir: DirName): void;
}

export function bindInput(handlers: InputHandlers): void {
  window.addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (handlers.intercept(e)) return;
    const dir = KEYMAP[e.key];
    if (dir) { e.preventDefault(); handlers.direction(dir); return; }
    if (e.key === 'p' || e.key === 'P') { handlers.pause(); return; }
    if (e.key === 'Enter' || e.key === ' ') handlers.confirm(e);
  });
  document.querySelectorAll<HTMLButtonElement>('.dpad button').forEach(b => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      handlers.dpad(b.dataset.dir as DirName);
    });
  });
}
