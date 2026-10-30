// Fixed 60 Hz timestep with an accumulator; rendering runs once per animation frame.

const STEP = 1000 / 60;
const MAX_FRAME_MS = 100;

export function startLoop(tick: () => void, draw: () => void): void {
  let last = 0;
  let acc = 0;
  const frame = (now: number): void => {
    acc += Math.min(MAX_FRAME_MS, now - last); last = now;
    while (acc >= STEP) { tick(); acc -= STEP; }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
