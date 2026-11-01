import { useEffect, useRef } from 'react';

export interface MousePos {
  /** normalized -1..1, left to right */
  x: number;
  /** normalized -1..1, bottom to top */
  y: number;
}

/**
 * Tracks the pointer position as a normalized -1..1 vector.
 *
 * Returns a ref (never a state) so consumers can read the latest value
 * inside rAF / GSAP tickers without triggering React re-renders.
 */
export function useMousePosition(): React.MutableRefObject<MousePos> {
  const pos = useRef<MousePos>({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pos.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return pos;
}
