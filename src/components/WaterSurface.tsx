import { useEffect, useRef, useState } from 'react';
import { createLiquidRipple, type LiquidRipple } from '../vendor/liquid-ripple';
import { createBackdrop } from '../lib/backdrop';

interface WaterSurfaceProps {
  ready: boolean;
  reduced: boolean;
  lite: boolean;
}

const YELLOW = '#ffe500';
const BASE_AMP = 0.34;

/**
 * Full-viewport water over an offscreen backdrop (yellow + OFFMODE type).
 *
 * Built on the vendored liquid-ripple fork: pointer moves spawn rings,
 * pointer speed and clicks temporarily raise wave amplitude (velocity-
 * based intensity), and the refracted backdrop texture makes the type
 * bend under the surface. Falls back to a static yellow + wordmark when
 * the effect can't run (reduced motion / no WebGL / shader error).
 */
export default function WaterSurface({ ready, reduced, lite }: WaterSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<LiquidRipple | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dprCap = lite ? 1 : 1.5;
    const backdrop = createBackdrop();
    // size the backdrop from the WATER CANVAS box — on iOS `h-svh` (small
    // viewport) and `window.innerHeight` (layout viewport) disagree when the
    // address bar collapses, and a mismatched texture would squash the type
    const redrawBackdrop = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      backdrop.draw(w, h, Math.min(window.devicePixelRatio || 1, dprCap));
    };
    redrawBackdrop();

    let boostTimer = 0;
    const boost = (amp: number, holdMs: number) => {
      handleRef.current?.setWave({ amplitude: amp });
      window.clearTimeout(boostTimer);
      boostTimer = window.setTimeout(
        () => handleRef.current?.setWave({ amplitude: BASE_AMP }),
        holdMs,
      );
    };

    const handle = createLiquidRipple(canvas, {
      palette: { top: YELLOW, bottom: YELLOW, glint: '#ffffff' },
      backdrop: backdrop.canvas,
      wave: {
        swell: 0.85,
        amplitude: BASE_AMP,
        ringSpeed: 0.33,
        decay: 2.3,
        wavelength: 55,
        life: 5,
        refraction: 0.2,
        caustics: 0.24,
        specular: 0.7,
      },
      ambient: 0, // spec: pointer stops → waves dissipate → calm water
      pointerThrottle: lite ? 140 : 100,
      dprCap,
      speed: 0.75,
      maxRipples: lite ? 16 : 24,
      interactive: 'window',
      respectReducedMotion: true,
      onUnsupported: () => setFailed(true),
    });

    if (!handle) {
      // reduced motion / no WebGL — static yellow + type is the fallback
      return;
    }
    handleRef.current = handle;

    // velocity → amplitude: fast pointer strokes throw bigger waves
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt; // px/ms
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      if (speed > 0.6) {
        boost(Math.min(0.55, BASE_AMP + speed * 0.1), 220);
      }
    };

    // click impulse: one larger drop, then settle back
    const onDown = () => boost(0.62, 260);

    // EXPLORE pill pressed: a big drop right at the button's centre
    const onActivate = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const r = t?.getBoundingClientRect?.();
      if (!r || !r.width || !r.height) return;
      handle.drop(r.left + r.width / 2, r.top + r.height / 2, 'client');
      boost(0.66, 320);
    };

    // orientation change / URL-bar collapse: redraw now (cheap) and once
    // more after layout settles so the texture always matches the canvas box
    let resizeTimer = 0;
    const redrawAndUpload = () => {
      redrawBackdrop();
      handle.setBackdrop(backdrop.canvas);
    };
    const onResize = () => {
      redrawAndUpload();
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(redrawAndUpload, 300);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('venom:activate', onActivate);
    window.addEventListener('resize', onResize);

    // re-draw once Anton has actually loaded so the baked type is correct
    document.fonts?.ready.then(() => {
      redrawBackdrop();
      handle.setBackdrop(backdrop.canvas);
    });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('venom:activate', onActivate);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(boostTimer);
      window.clearTimeout(resizeTimer);
      handle.destroy();
      handleRef.current = null;
    };
  }, [ready, reduced, lite]);

  return (
    <div className="absolute inset-0 bg-electric">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{ width: '100%', height: '100%' }}
        data-testid="water-surface"
      />

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="wordmark select-none">OFFMODE</div>
        </div>
      )}

      <h1 className="sr-only">OFFMODE</h1>
    </div>
  );
}
