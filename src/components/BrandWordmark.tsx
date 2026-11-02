import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { MousePos } from '../hooks/useMousePosition';
import { rippleWaveAt, type RipplePool } from '../hooks/useRipples';

const LETTERS = 'OFFMODE'.split('');

/* deterministic per-letter paint-pour offsets (em units) */
const LETTER_OFFSETS = [0.035, -0.022, 0.045, -0.03, 0.04, -0.018, 0.03];

interface BrandWordmarkProps {
  ready: boolean;
  reduced: boolean;
  mouseRef: React.MutableRefObject<MousePos>;
  ripples: React.RefObject<RipplePool>;
}

export default function BrandWordmark({
  ready,
  reduced,
  mouseRef,
  ripples,
}: BrandWordmarkProps) {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);

  /* intro: per-letter mask reveal + tracking settle + chrome echo */
  useEffect(() => {
    const el = wordmarkRef.current;
    if (!el || !ready) return;

    const letters = el.querySelectorAll('.wordmark-letter');
    const echo = el.querySelector('.wordmark-echo');

    if (reduced) {
      gsap.set(letters, { yPercent: 0, y: 0 });
      gsap.set(el, { letterSpacing: '-0.012em' });
      gsap.set(echo, { opacity: 1, xPercent: 0, yPercent: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    let finished = false;
    // NOTE: y:0 matters — GSAP parses the inline translateY(115%) hint as a
    // pixel offset, which must be zeroed or it survives the yPercent tween
    tl.fromTo(
      letters,
      { yPercent: 115, y: 0 },
      { yPercent: 0, y: 0, duration: 1.0, stagger: 0.055 },
      0.35,
    )
      .fromTo(
        el,
        { letterSpacing: '0.08em' },
        { letterSpacing: '-0.012em', duration: 1.25, ease: 'power3.inOut' },
        0.3,
      )
      .fromTo(
        echo,
        { opacity: 0, xPercent: -6, yPercent: -6 },
        { opacity: 1, xPercent: 0, yPercent: 0, duration: 1.0 },
        0.9,
      );
    tl.eventCallback('onComplete', () => {
      finished = true;
    });

    // failsafe: if rAF loop is starved (slow GPU / software GL), snap to the
    // final composition so the wordmark is never stuck hidden
    const failsafe = window.setTimeout(() => {
      if (!finished) {
        tl.progress(1, true);
      }
    }, 5000);

    return () => {
      tl.kill();
      window.clearTimeout(failsafe);
    };
  }, [ready, reduced]);

  /* subtle mouse parallax on the whole wordmark, driven by GSAP's ticker */
  useEffect(() => {
    if (!ready || reduced) return;
    const el = parallaxRef.current;
    if (!el) return;

    const qx = gsap.quickTo(el, 'x', { duration: 1.1, ease: 'power3.out' });
    const qy = gsap.quickTo(el, 'y', { duration: 1.1, ease: 'power3.out' });

    const tick = () => {
      qx(mouseRef.current.x * 14);
      qy(mouseRef.current.y * 8);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [ready, reduced, mouseRef]);

  /* water physics: each letter bobs with the shared ripple field and
     swells away from the pointer like a disturbed liquid surface */
  useEffect(() => {
    const el = wordmarkRef.current;
    if (!el || !ready) return;
    const offs = Array.from(el.querySelectorAll<HTMLElement>('.wordmark-letter-off'));
    if (offs.length === 0) return;

    if (reduced) {
      offs.forEach((o, i) => gsap.set(o, { x: 0, y: `${LETTER_OFFSETS[i]}em`, skewX: 0 }));
      return;
    }

    let centers: { x: number; y: number }[] = [];
    let fontSize = 1;
    let started = false;
    const xs: Array<ReturnType<typeof gsap.quickTo>> = [];
    const ys: Array<ReturnType<typeof gsap.quickTo>> = [];
    const sks: Array<ReturnType<typeof gsap.quickTo>> = [];

    const measure = () => {
      const w = window.innerWidth;
      const h = Math.max(window.innerHeight, 1);
      fontSize = parseFloat(getComputedStyle(offs[0]).fontSize) || 1;
      centers = offs.map((o) => {
        const r = o.getBoundingClientRect();
        return {
          x: ((r.left + r.width / 2) / w) * 2 - 1,
          y: -(((r.top + r.height / 2) / h) * 2 - 1),
        };
      });
    };

    const tick = () => {
      if (!started || centers.length !== offs.length) return;
      const m = mouseRef.current;
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      const live = m.x !== 0 || m.y !== 0;
      const amp = fontSize * 0.035;

      for (let i = 0; i < offs.length; i++) {
        const c = centers[i];
        const wave = rippleWaveAt(ripples.current, c.x, c.y, aspect);
        let px = 0;
        let py = wave * amp;
        let skew = wave * 6;

        if (live) {
          // local swell: letters rise and lean away from the cursor
          const dx = (c.x - m.x) * aspect * 0.5;
          const dy = (c.y - m.y) * 0.5;
          const d2 = dx * dx + dy * dy;
          const prox = Math.exp(-d2 * 16);
          const s = dx >= 0 ? 1 : -1;
          py -= prox * amp * 0.4;
          px += prox * amp * 0.3 * s;
          skew += prox * 3 * s;
        }

        xs[i](px);
        ys[i](LETTER_OFFSETS[i] * fontSize + py);
        sks[i](skew);
      }
    };

    // wait for the intro reveal to settle before measuring letter centers
    const boot = window.setTimeout(() => {
      measure();
      offs.forEach((o) => {
        xs.push(gsap.quickTo(o, 'x', { duration: 0.95, ease: 'power2.out' }));
        ys.push(gsap.quickTo(o, 'y', { duration: 0.95, ease: 'power2.out' }));
        sks.push(gsap.quickTo(o, 'skewX', { duration: 0.95, ease: 'power2.out' }));
      });
      started = true;
      gsap.ticker.add(tick);
    }, 1800);

    const onResize = () => {
      if (started) measure();
    };
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(() => {
      if (started) measure();
    });

    return () => {
      window.clearTimeout(boot);
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
    };
  }, [ready, reduced, mouseRef, ripples]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      data-testid="wordmark-positioner"
    >
      {/* liquid-paint warp filter — keeps the wordmark real text while the
          letterforms wobble like poured paint */}
      <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <filter
          id="liquid-paint"
          x="-8%"
          y="-20%"
          width="116%"
          height="145%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01 0.026"
            numOctaves="2"
            seed="7"
            result="paintNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="paintNoise"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <div ref={parallaxRef} className="wordmark-parallax">
        <h1
          ref={wordmarkRef}
          className="wordmark relative"
          aria-label="OFFMODE"
          style={{ filter: 'url(#liquid-paint)' }}
        >
          <span className="wordmark-echo" aria-hidden="true">
            OFFMODE
          </span>
          {LETTERS.map((ch, i) => (
            <span className="wordmark-mask" key={i}>
              <span className="wordmark-letter" style={{ transform: 'translateY(115%)' }}>
                <span className="wordmark-letter-off">{ch}</span>
              </span>
            </span>
          ))}
        </h1>
      </div>
    </div>
  );
}
