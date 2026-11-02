import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

export interface OpenLook {
  src: string;
  word: string;
  index: number;
}

interface LookDetailProps {
  look: OpenLook;
  reduced: boolean;
  onClose: () => void;
}

const LINES = Array.from({ length: 9 }, (_, i) => i);

/**
 * Kinetic look detail — a Codrops-style click-to-open overlay for one plane.
 * Open: the type wall scales/rotates out of the center while every line
 * streaks across, then the article rises behind it (text up, image revealed
 * through an opposite-translate mask) and the shot starts drifting idly
 * (a-drift). Back / Escape reverses the whole thing and closes.
 */
export default function LookDetail({
  look,
  reduced,
  onClose,
}: LookDetailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const driftRef = useRef<gsap.core.Tween | null>(null);
  const busyRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const wall = wallRef.current;
    const imgWrap = imgWrapRef.current;
    const img = imgRef.current;
    if (!root || !wall || !imgWrap || !img) return;

    const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
    const texts = textRefs.current.filter(Boolean) as HTMLElement[];

    // scroll lock is handled by App (it owns the scroll container)
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(root, { opacity: 1 });
        gsap.set([wall, imgWrap, texts], { opacity: 1 });
        return;
      }

      const startDrift = () => {
        driftRef.current?.kill();
        driftRef.current = gsap.to(img, {
          x: 8,
          y: -10,
          duration: 3.4,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      };

      gsap.set(root, { opacity: 0 });
      gsap.set(lines, { opacity: 0.06, xPercent: 20 });
      gsap.set(texts, { opacity: 0, yPercent: 50 });
      gsap.set(imgWrap, { yPercent: 100 });
      gsap.set(img, { yPercent: -100 });

      const tl = gsap.timeline({
        paused: true,
        onComplete: startDrift,
      });
      tlRef.current = tl;

      // 1 — the type wall scales and swings open (KPTT shape)
      tl.to(root, { duration: 0.55, opacity: 1, ease: 'power2.out' }, 0)
        .to(
          wall,
          {
            duration: 1.4,
            scale: 2.7,
            rotation: -90,
            ease: 'power2.inOut',
          },
          0.1,
        )
        .to(
          lines,
          {
            keyframes: [
              { xPercent: 40, duration: 1, ease: 'power1.inOut' },
              { xPercent: -200, duration: 1.5, ease: 'power1.in' },
            ],
            stagger: 0.04,
          },
          0.1,
        )
        .to(
          lines,
          {
            keyframes: [
              { opacity: 1, duration: 1, ease: 'power1.in' },
              { opacity: 0, duration: 1.5, ease: 'power1.in' },
            ],
            stagger: 0.04,
          },
          0.1,
        );

      // 2 — the article rises at type*0.75, image through the opposite mask
      const contentAt = 0.1 + 1.4 * 0.75;
      tl.to(
        texts,
        {
          duration: 1,
          opacity: 1,
          yPercent: 0,
          stagger: 0.04,
          ease: 'expo.out',
        },
        contentAt,
      )
        .to(
          imgWrap,
          { duration: 1, yPercent: 0, ease: 'expo.out' },
          contentAt,
        )
        .to(img, { duration: 1, yPercent: 0, ease: 'expo.out' }, contentAt)
        .set(wall, { opacity: 0 }, contentAt + 0.6);

      tl.play();
    }, root);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      ctx.revert();
      tlRef.current = null;
      driftRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    driftRef.current?.kill();
    if (reduced || !tlRef.current) {
      onClose();
      return;
    }
    const tl = tlRef.current;
    tl.reverse();
    tl.eventCallback('onComplete', null);
    tl.eventCallback('onReverseComplete', () => {
      onClose();
      busyRef.current = false;
    });
  };

  const num = String(look.index + 1).padStart(2, '0');

  return (
    <div
      ref={rootRef}
      id="look-detail"
      className="fixed inset-0 z-[95] bg-[#0e0e0e] text-white"
      style={{ opacity: 0 }}
    >
      {/* type wall */}
      <div
        ref={wallRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col justify-center will-change-transform"
      >
        {LINES.map((i) => (
          <span
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            className="block whitespace-nowrap font-display uppercase leading-[0.92] tracking-tight text-[clamp(3rem,9vw,8rem)]"
          >
            {`${look.word} OFFMODE WEAR YOUR MOOD `}
            {`${look.word} OFFMODE WEAR YOUR MOOD`}
          </span>
        ))}
      </div>

      {/* article */}
      <div ref={contentRef} className="absolute inset-0 grid grid-cols-1 md:grid-cols-2">
        <div className="relative flex flex-col justify-between p-6 md:p-10">
          <div>
            <div
              ref={(el) => {
                textRefs.current[0] = el;
              }}
              className="font-display text-[clamp(3rem,7vw,6rem)] uppercase leading-[0.9]"
            >
              {look.word}
            </div>
            <div
              ref={(el) => {
                textRefs.current[1] = el;
              }}
              className="mt-3 font-sans text-[10px] tracking-[0.4em] opacity-60"
            >
              {`LOOK ${num} / OFFMODE FW26`}
            </div>
            <p
              ref={(el) => {
                textRefs.current[2] = el;
              }}
              className="mt-6 max-w-[34ch] font-sans text-[11px] leading-relaxed tracking-[0.18em] opacity-70"
            >
              WEAR YOUR MOOD. A LOOK FROM THE OFFMODE STACK — SELECTED FROM
              THE DEPTH GALLERY. SYSTEM:OFFMODE.
            </p>
          </div>

          <button
            ref={(el) => {
              textRefs.current[3] = el;
            }}
            type="button"
            onClick={close}
            className="self-start border border-white/30 px-6 py-3 font-sans text-[10px] tracking-[0.4em] transition-colors hover:bg-white hover:text-black"
          >
            ← BACK
          </button>
        </div>

        <div className="relative overflow-hidden md:p-10">
          <div ref={imgWrapRef} className="relative h-full w-full overflow-hidden">
            <img
              ref={imgRef}
              src={look.src}
              alt={look.word}
              draggable={false}
              className="h-full w-full object-cover will-change-transform"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
