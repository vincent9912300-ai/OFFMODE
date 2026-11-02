import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { MousePos } from './useMousePosition';

/* Viscous pointer trail — the flow follows the drag path like butter
   being drawn across the surface: a smoothed line of points in order,
   each slowly melting outward and fading. No expanding rings. */

export const TRAIL_MAX = 16;
export const TRAIL_LIFE = 3.5; // seconds until a trail point melts away

const SPAWN_DIST = 0.03; // normalized travel before a new point is laid
const SPAWN_COOLDOWN_MS = 40;
const SMOOTH_RATE = 4.5; // pointer low-pass (1/s) — buttery lag, not a jerk

export interface TrailPoint {
  x: number; // normalized -1..1, left→right
  y: number; // normalized -1..1, bottom→top
  age: number; // seconds since laid down
  strength: number;
}

export interface TrailPool {
  /** oldest first — shader segments run points[i] → points[i+1] in order */
  points: TrailPoint[];
  /** low-passed pointer the trail actually follows */
  smooth: { x: number; y: number };
}

export function usePointerTrail(
  mouseRef: React.MutableRefObject<MousePos>,
  enabled: boolean,
): React.RefObject<TrailPool> {
  const pool = useRef<TrailPool>({
    points: [],
    smooth: { x: 0, y: 0 },
  });

  useEffect(() => {
    if (!enabled) return;

    let lastSpawn = 0;
    let prevT = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - prevT) / 1000, 0.05);
      prevT = now;

      const p = pool.current;
      const m = mouseRef.current;

      // viscous lag: the flow catches up smoothly, never snaps
      const k = 1 - Math.exp(-dt * SMOOTH_RATE);
      p.smooth.x += (m.x - p.smooth.x) * k;
      p.smooth.y += (m.y - p.smooth.y) * k;

      // melt away from the tail
      while (p.points.length > 0 && p.points[0].age >= TRAIL_LIFE) {
        p.points.shift();
      }
      for (const pt of p.points) pt.age += dt;

      const last = p.points[p.points.length - 1];
      if (!last) {
        // seed once the pointer actually moves
        if (Math.abs(m.x) + Math.abs(m.y) > 0.05) {
          p.points.push({ x: p.smooth.x, y: p.smooth.y, age: 0, strength: 1 });
          lastSpawn = now;
        }
        return;
      }

      const dx = p.smooth.x - last.x;
      const dy = p.smooth.y - last.y;
      if (Math.hypot(dx, dy) >= SPAWN_DIST && now - lastSpawn >= SPAWN_COOLDOWN_MS) {
        // lay the next point in drag order (top→bottom stays a line)
        p.points.push({ x: p.smooth.x, y: p.smooth.y, age: 0, strength: 1 });
        if (p.points.length > TRAIL_MAX) p.points.shift();
        lastSpawn = now;
      }
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [enabled, mouseRef]);

  return pool;
}
