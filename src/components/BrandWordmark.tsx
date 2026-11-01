import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { MousePos } from '../hooks/useMousePosition';

const LETTERS = 'OFFMODE'.split('');

interface BrandWordmarkProps {
  ready: boolean;
  reduced: boolean;
  mouseRef: React.MutableRefObject<MousePos>;
}

export default function BrandWordmark({
  ready,
  reduced,
  mouseRef,
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
      gsap.set(letters, { yPercent: 0 });
      gsap.set(el, { letterSpacing: '-0.045em' });
      gsap.set(echo, { opacity: 1, xPercent: 0, yPercent: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.fromTo(
      letters,
      { yPercent: 115 },
      { yPercent: 0, duration: 1.0, stagger: 0.055 },
      0.35,
    )
      .fromTo(
        el,
        { letterSpacing: '0.06em' },
        { letterSpacing: '-0.045em', duration: 1.25, ease: 'power3.inOut' },
        0.3,
      )
      .fromTo(
        echo,
        { opacity: 0, xPercent: -6, yPercent: -6 },
        { opacity: 1, xPercent: 0, yPercent: 0, duration: 1.0 },
        0.9,
      );

    return () => {
      tl.kill();
    };
  }, [ready, reduced]);

  /* subtle mouse parallax on the whole wordmark, driven by GSAP's ticker */
  useEffect(() => {
    if (!ready || reduced) return;
    const el = parallaxRef.current;
    if (!el) return;

    const qx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' });
    const qy = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' });

    const tick = () => {
      qx(mouseRef.current.x * 14);
      qy(mouseRef.current.y * 8);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [ready, reduced, mouseRef]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      data-testid="wordmark-positioner"
    >
      <div ref={parallaxRef} className="wordmark-parallax">
        <h1
          ref={wordmarkRef}
          className="wordmark relative"
          aria-label="OFFMODE"
        >
          <span className="wordmark-echo" aria-hidden="true">
            OFFMODE
          </span>
          {LETTERS.map((ch, i) => (
            <span className="wordmark-mask" key={i}>
              <span className="wordmark-letter" style={{ transform: 'translateY(115%)' }}>
                {ch}
              </span>
            </span>
          ))}
        </h1>
      </div>
    </div>
  );
}
