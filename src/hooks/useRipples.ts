import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { MousePos } from './useMousePosition';

/* Shared water-ripple physics — one pool drives both the WebGL rings
   and the wordmark's per-letter bobbing, so they stay in sync.

   A moving pointer "throws rocks": each spawn starts an expanding,
   damped ring that travels outward like a real wavefront. */

export const MAX_RIPPLES = 10;
export const RIPPLE_LIFE = 3.2; // seconds until a ring dies

/* wave constants — keep identical to the GLSL values in LiquidBackground */
const RIPPLE_SPEED = 0.42; // ring radius growth, p-units / s (slow, floating)
const RIPPLE_W0 = 0.05; // packet width at birth
const RIPPLE_WSPREAD = 0.05; // packet widening per second
const RIPPLE_K = 26.0; // spatial frequency of the wave
const RIPPLE_DECAY = 0.8; // amplitude decay, 1/s
const RIPPLE_FADE0 = 2.0; // fade-out window (s) — must match GLSL smoothstep

const SPAWN_COOLDOWN_MS = 130;
const SPAWN_DIST = 0.045; // normalized travel before a new rock is thrown

export interface Ripple {
  x: number; // normalized -1..1, left→right
  y: number; // normalized -1..1, bottom→top
  age: number; // seconds since spawn
  strength: number; // 0 = dead
}

export interface RipplePool {
  ripples: Ripple[];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Combined wave height of every live ripple at a normalized point.
 * Returns roughly -1..1 — mirrors the GLSL ring math one-for-one.
 */
export function rippleWaveAt(
  pool: RipplePool,
  x: number,
  y: number,
  aspect: number,
): number {
  const px = x * aspect * 0.5;
  const py = y * 0.5;
  let sum = 0;
  for (const r of pool.ripples) {
    if (r.strength <= 0.002 || r.age >= RIPPLE_LIFE) continue;
    const dx = px - r.x * aspect * 0.5;
    const dy = py - r.y * 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    const rad = r.age * RIPPLE_SPEED;
    const width = RIPPLE_W0 + r.age * RIPPLE_WSPREAD;
    const x0 = d - rad;
    const env = Math.exp(-(x0 * x0) / (width * width));
    const amp =
      r.strength *
      Math.exp(-r.age * RIPPLE_DECAY) *
      (1 - smoothstep(RIPPLE_FADE0, RIPPLE_LIFE, r.age));
    sum += Math.sin(x0 * RIPPLE_K) * env * amp;
  }
  return sum;
}

/**
 * Owns the ripple pool: spawns rings from pointer motion and ages them
 * on the GSAP ticker. One pool per page, created in <Hero>.
 */
export function useRipples(
  mouseRef: React.MutableRefObject<MousePos>,
  enabled: boolean,
): React.RefObject<RipplePool> {
  const pool = useRef<RipplePool>({
    ripples: Array.from({ length: MAX_RIPPLES }, () => ({
      x: 0,
      y: 0,
      age: RIPPLE_LIFE,
      strength: 0,
    })),
  });

  useEffect(() => {
    if (!enabled) return;

    let slot = 0;
    let lastSpawn = 0;
    let accum = 0;
    let prevX = mouseRef.current.x;
    let prevY = mouseRef.current.y;
    let prevT = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - prevT) / 1000, 0.05);
      prevT = now;

      const m = mouseRef.current;
      const dist = Math.hypot(m.x - prevX, m.y - prevY);
      prevX = m.x;
      prevY = m.y;
      accum += dist;

      // throw a "rock" once the pointer has travelled far enough
      if (
        dist > 0.0004 &&
        now - lastSpawn >= SPAWN_COOLDOWN_MS &&
        (accum >= SPAWN_DIST || now - lastSpawn > 320)
      ) {
        const speed = dist / Math.max(dt, 1 / 120);
        const r = pool.current.ripples[slot];
        r.x = m.x;
        r.y = m.y;
        r.age = 0;
        r.strength = Math.min(1, 0.4 + speed * 0.5);
        slot = (slot + 1) % MAX_RIPPLES;
        lastSpawn = now;
        accum = 0;
      }

      for (const r of pool.current.ripples) {
        if (r.strength <= 0) continue;
        r.age += dt;
        if (r.age >= RIPPLE_LIFE) {
          r.age = RIPPLE_LIFE;
          r.strength = 0;
        }
      }
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [enabled, mouseRef]);

  return pool;
}
