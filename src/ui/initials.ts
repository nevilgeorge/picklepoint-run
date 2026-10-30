// Three-slot arcade initials entry: ↑/↓ cycle A–Z, ←/→ move, letters fill and advance, Backspace clears and backs up.

import type { DirName } from '../game/movement';
import { h } from './dom';

const INITIALS_KEY = 'picklepoint-initials';
const SLOTS = 3;
const A = 'A'.charCodeAt(0);

export function loadInitials(): string {
  try {
    const v = localStorage.getItem(INITIALS_KEY) || '';
    return /^[A-Z]{3}$/.test(v) ? v : '';
  } catch {
    return '';
  }
}

export function saveInitials(initials: string): void {
  try { localStorage.setItem(INITIALS_KEY, initials); } catch { /* storage unavailable */ }
}

const CHEVRON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const CHEVRON_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export class InitialsEntry {
  readonly el: HTMLElement;
  private letters: string[];
  private cursor = 0;
  private readonly slots: HTMLButtonElement[] = [];
  private readonly up: HTMLButtonElement;
  private readonly down: HTMLButtonElement;

  constructor(prefill: string) {
    this.letters = Array.from({ length: SLOTS }, (_, i) => prefill[i] ?? '');
    this.up = h('button', { type: 'button', class: 'chev up', 'aria-label': 'Next letter', tabindex: -1 });
    this.down = h('button', { type: 'button', class: 'chev down', 'aria-label': 'Previous letter', tabindex: -1 });
    this.up.innerHTML = CHEVRON_UP;
    this.down.innerHTML = CHEVRON_DOWN;
    this.up.addEventListener('click', () => this.cycle(1));
    this.down.addEventListener('click', () => this.cycle(-1));
    this.el = h('div', { class: 'initials', role: 'group', 'aria-label': 'Your initials' });
    for (let i = 0; i < SLOTS; i++) {
      const slot = h('button', { type: 'button', class: 'slot' });
      slot.addEventListener('click', () => { this.cursor = i; this.render(); });
      this.slots.push(slot);
      this.el.append(h('div', { class: 'slot-wrap' }, slot));
    }
    this.render();
  }

  /** Three letters A–Z, or null if any slot is empty. */
  value(): string | null {
    const v = this.letters.join('');
    return /^[A-Z]{3}$/.test(v) ? v : null;
  }

  focus(): void { this.slots[this.cursor].focus({ preventScroll: true }); }

  /** Arrow keys / d-pad. */
  move(dir: DirName): void {
    if (dir === 'up') this.cycle(1);
    else if (dir === 'down') this.cycle(-1);
    else {
      this.cursor = Math.max(0, Math.min(SLOTS - 1, this.cursor + (dir === 'left' ? -1 : 1)));
      this.render();
    }
  }

  /** Handle a keydown; returns true if consumed. */
  handleKey(e: KeyboardEvent): boolean {
    const dirs: Record<string, DirName> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (dirs[e.key]) { e.preventDefault(); this.move(dirs[e.key]); return true; }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.letters[this.cursor] = '';
      this.cursor = Math.max(0, this.cursor - 1);
      this.render();
      return true;
    }
    if (/^[a-zA-Z]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.letters[this.cursor] = e.key.toUpperCase();
      this.cursor = Math.min(SLOTS - 1, this.cursor + 1);
      this.render();
      return true;
    }
    return false;
  }

  private cycle(step: number): void {
    const cur = this.letters[this.cursor];
    const idx = cur ? cur.charCodeAt(0) - A : step > 0 ? -1 : 0;
    this.letters[this.cursor] = String.fromCharCode(A + ((idx + step + 26) % 26));
    this.render();
  }

  private render(): void {
    const hadFocus = this.el.contains(document.activeElement);
    this.slots.forEach((slot, i) => {
      const active = i === this.cursor;
      slot.textContent = this.letters[i] || '_';
      slot.classList.toggle('active', active);
      slot.classList.toggle('empty', !this.letters[i]);
      slot.setAttribute('aria-label', `Initial ${i + 1}: ${this.letters[i] || 'empty'}`);
      slot.setAttribute('aria-current', active ? 'true' : 'false');
      slot.tabIndex = active ? 0 : -1;
    });
    const wrap = this.slots[this.cursor].parentElement!;
    wrap.prepend(this.up);
    wrap.append(this.down);
    if (hadFocus) this.focus();
  }
}
