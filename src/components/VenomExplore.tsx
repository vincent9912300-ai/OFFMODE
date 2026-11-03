import { useEffect, useRef } from 'react';
import { mountVenomButton } from '../vendor/venom-button/venom.js';

interface VenomExploreProps {
  label?: string;
  /** distance from the right edge in CSS px (default 44, the vendored value) */
  padRight?: number;
  /** distance from the bottom edge in CSS px (default 44, the vendored value) */
  padBottom?: number;
  /** distance from the left edge in CSS px (overrides padRight) */
  padLeft?: number;
  /** distance from the top edge in CSS px (overrides padBottom) */
  padTop?: number;
  /** pin the goo to a display edge: slab hidden, all goo comes out of the border */
  side?: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * EXPLORE pill in the bottom-right corner, rendered by the vendored
 * venom-button WebGL goo (transparent overlay above the water).
 *
 * The mount is deferred one tick so React StrictMode's double-invoke of
 * the effect cancels itself before anything attaches (the vendored script
 * is a one-shot mount with no teardown).
 */
export default function VenomExplore({
  label = 'EXPLORE',
  padRight = 44,
  padBottom = 44,
  padLeft,
  padTop,
  side,
}: VenomExploreProps) {
  const stageRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let destroy: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const canvas = stageRef.current;
      const hit = hitRef.current;
      if (!canvas || !hit) return;
      destroy = mountVenomButton({
        canvas,
        hit,
        label,
        padRight,
        padBottom,
        padLeft,
        padTop,
        side,
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      destroy?.();
      destroy = undefined;
    };
  }, [label, padRight, padBottom, padLeft, padTop, side]);

  return (
    <>
      <canvas ref={stageRef} className="venom-stage" aria-hidden="true" />
      <button ref={hitRef} type="button" className="venom-hit" aria-label={label}>
        {label}
      </button>
    </>
  );
}
