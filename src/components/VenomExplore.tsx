import { useEffect, useRef } from 'react';
import { mountVenomButton } from '../vendor/venom-button/venom.js';

interface VenomExploreProps {
  label?: string;
}

/**
 * EXPLORE pill in the bottom-right corner, rendered by the vendored
 * venom-button WebGL goo (transparent overlay above the water).
 *
 * The mount is deferred one tick so React StrictMode's double-invoke of
 * the effect cancels itself before anything attaches (the vendored script
 * is a one-shot mount with no teardown).
 */
export default function VenomExplore({ label = 'EXPLORE' }: VenomExploreProps) {
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
        padRight: 44,
        padBottom: 44,
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      destroy?.();
      destroy = undefined;
    };
  }, [label]);

  return (
    <>
      <canvas ref={stageRef} className="venom-stage" aria-hidden="true" />
      <button ref={hitRef} type="button" className="venom-hit" aria-label={label}>
        {label}
      </button>
    </>
  );
}
