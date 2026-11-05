import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface OpenLook {
  src: string;
  word?: string;
  index: number;
  hero?: string;
  title?: string;
  details?: string;
  palette?: string;
  accent?: string;
  paletteColors?: PaletteColor[];
}

interface LookDetailProps {
  look: OpenLook;
  reduced: boolean;
  onClose: () => void;
}

const LINES = Array.from({ length: 9 }, (_, i) => i);

function getReadableColor(hex: string): string {
  if (!hex) return '#ffffff';
  const darks: Record<string, string> = {
    '#111111': '#E0E0E0',
    '#1a1a1a': '#E0E0E0',
    '#000000': '#E0E0E0',
    '#2c3e50': '#8BAAC8',
    '#2b3e58': '#8BAAC8',
    '#4a0000': '#D45D5D',
    '#4a2e18': '#D29B75',
    '#4b2d17': '#D29B75',
    '#5c4033': '#C9A088',
    '#536267': '#A5B5BA',
    '#5b1425': '#CE5C75',
  };
  return darks[hex.toLowerCase()] || hex;
}

function highlightColorWords(str: string, paletteColors: PaletteColor[] = []) {
  if (!paletteColors || paletteColors.length === 0) return str;

  const colorMap = new Map<string, string>();
  paletteColors.forEach((c) => {
    colorMap.set(c.name.toLowerCase(), c.hex);
    c.name.split(/\s+/).forEach((w) => {
      const lower = w.toLowerCase();
      if (lower.length > 3 && !['with', 'over', 'dark', 'light', 'and'].includes(lower)) {
        if (!colorMap.has(lower)) colorMap.set(lower, c.hex);
      }
    });
  });

  const words = Array.from(colorMap.keys()).sort((a, b) => b.length - a.length);
  if (words.length === 0) return str;

  const regex = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
  const tokens = str.split(regex);

  return tokens.map((token, i) => {
    const hex = colorMap.get(token.toLowerCase());
    if (hex) {
      return (
        <span
          key={i}
          className="font-semibold underline decoration-white/30 underline-offset-2 transition-colors"
          style={{ color: getReadableColor(hex) }}
        >
          {token}
        </span>
      );
    }
    return token;
  });
}

function formatDressingDetails(text: string, look: OpenLook) {
  if (!text) return null;

  const parts = text.split(/(Boy:|Girl:)/g);
  if (parts.length > 1) {
    return (
      <div className="space-y-3">
        {parts.map((part, idx) => {
          if (part === 'Boy:') {
            const boyCol =
              look.paletteColors?.find((c) =>
                ['Camel', 'Lavender', 'Black', 'Cobalt blue', 'Burgundy'].includes(c.name),
              )?.hex ||
              look.accent ||
              '#ffe500';
            return (
              <span
                key={idx}
                className="inline-block mt-2 font-display text-xs md:text-sm uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10"
                style={{ color: getReadableColor(boyCol) }}
              >
                Boy:
              </span>
            );
          }
          if (part === 'Girl:') {
            const girlCol =
              look.paletteColors?.find((c) =>
                [
                  'Ivory',
                  'Cream',
                  'Bubblegum pink',
                  'Wine red',
                  'Bright orange',
                  'Crimson red',
                ].includes(c.name),
              )?.hex || '#FF85CB';
            return (
              <span
                key={idx}
                className="inline-block mt-2 font-display text-xs md:text-sm uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10"
                style={{ color: getReadableColor(girlCol) }}
              >
                Girl:
              </span>
            );
          }
          return (
            <p
              key={idx}
              className="font-sans text-xs md:text-[13px] leading-relaxed tracking-wide text-white/95"
            >
              {highlightColorWords(part, look.paletteColors)}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <p className="font-sans text-xs md:text-[13px] leading-relaxed tracking-wide text-white/95">
      {highlightColorWords(text, look.paletteColors)}
    </p>
  );
}

/**
 * Individual Look Detail — displays all data provided:
 * - Look Hero Name (e.g. Duo 1, Boy 2, Girl 3) with accent styling
 * - Style Name prominently displayed
 * - Colour palette with color-matched text and swatches
 * - Dressing details with character roles and garment color highlighting
 * - Full contain-view high-res portrait image with drift
 */
export default function LookDetail({ look, reduced, onClose }: LookDetailProps) {
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

  useEffect(() => {
    document.body.classList.add('look-open');
    return () => document.body.classList.remove('look-open');
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const wall = wallRef.current;
    const imgWrap = imgWrapRef.current;
    const img = imgRef.current;
    if (!root || !wall || !imgWrap || !img) return;

    const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
    const texts = textRefs.current.filter(Boolean) as HTMLElement[];

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(root, { opacity: 1 });
        gsap.set([wall, imgWrap, texts], { opacity: 1 });
        return;
      }

      const startDrift = () => {
        driftRef.current?.kill();
        driftRef.current = gsap.to(img, {
          x: 6,
          y: -8,
          duration: 3.4,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      };

      gsap.set(root, { opacity: 0 });
      gsap.set(lines, { opacity: 0.06, xPercent: 20 });
      gsap.set(texts, { opacity: 0, yPercent: 40 });
      gsap.set(imgWrap, { yPercent: 100 });
      gsap.set(img, { yPercent: -100 });

      const tl = gsap.timeline({
        paused: true,
        onComplete: startDrift,
      });
      tlRef.current = tl;

      // 1 — kinetic typography wall swings open
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

      // 2 — editorial article rises, image reveals through opposite mask
      const contentAt = 0.1 + 1.4 * 0.75;
      tl.to(
        texts,
        {
          duration: 1,
          opacity: 1,
          yPercent: 0,
          stagger: 0.05,
          ease: 'expo.out',
        },
        contentAt,
      )
        .to(imgWrap, { duration: 1, yPercent: 0, ease: 'expo.out' }, contentAt)
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

  const styleTitle = look.title || look.word || 'LOOK DETAIL';
  const heroName = look.hero || `LOOK ${String(look.index + 1).padStart(2, '0')}`;
  const accentColor = look.accent || '#ffe500';

  return (
    <div
      ref={rootRef}
      id="look-detail"
      className="fixed inset-0 z-[95] bg-[#0e0e0e] text-white"
      style={{ opacity: 0 }}
    >
      {/* background kinetic type wall */}
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
            style={{ color: `${accentColor}18` }}
          >
            {`${heroName} ${styleTitle} OFFMODE `}
            {`${heroName} ${styleTitle} OFFMODE`}
          </span>
        ))}
      </div>

      {/* article grid */}
      <div
        ref={contentRef}
        className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 overflow-y-auto md:overflow-hidden"
      >
        {/* left column: full look documentation */}
        <div className="relative flex flex-col justify-between p-6 md:p-12 overflow-y-auto max-h-screen">
          <div className="space-y-6">
            {/* Header: Hero badge & Style Name */}
            <div
              ref={(el) => {
                textRefs.current[0] = el;
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-display text-sm md:text-base tracking-[0.35em] uppercase px-3 py-1 rounded-sm border"
                  style={{
                    color: getReadableColor(accentColor),
                    borderColor: `${accentColor}40`,
                    backgroundColor: `${accentColor}12`,
                  }}
                >
                  {heroName}
                </span>
                <span className="font-sans text-[10px] tracking-[0.4em] uppercase text-white/90">
                  SYSTEM:OFFMODE FW26
                </span>
              </div>
              <h1 className="mt-4 font-display text-[clamp(2.2rem,4.8vw,4.2rem)] uppercase leading-[0.92] tracking-tight -skew-x-2 text-white drop-shadow-md">
                {styleTitle}
              </h1>
            </div>

            {/* Colour Palette Section with matched font colors */}
            <div
              ref={(el) => {
                textRefs.current[1] = el;
              }}
              className="pt-2"
            >
              <h2 className="font-sans text-[10px] tracking-[0.4em] uppercase text-white/80 mb-3 flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                COLOUR PALETTE
              </h2>
              <div className="flex flex-wrap gap-2">
                {look.paletteColors && look.paletteColors.length > 0 ? (
                  look.paletteColors.map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-sans tracking-wide border border-white/10 bg-white/5 shadow-sm"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm"
                        style={{
                          backgroundColor: col.hex,
                          border:
                            col.hex === '#111111' || col.hex === '#1A1A1A'
                              ? '1px solid rgba(255,255,255,0.4)'
                              : undefined,
                        }}
                      />
                      <span
                        style={{ color: getReadableColor(col.hex) }}
                        className="font-medium"
                      >
                        {col.name}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-white/90">{look.palette}</span>
                )}
              </div>
            </div>

            {/* Dressing Details Section with data-matched font colors */}
            <div
              ref={(el) => {
                textRefs.current[2] = el;
              }}
              className="pt-2 pb-4"
            >
              <h2 className="font-sans text-[10px] tracking-[0.4em] uppercase text-white/80 mb-3 flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                DRESSING DETAILS
              </h2>
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                {formatDressingDetails(look.details || '', look)}
              </div>
            </div>
          </div>

          {/* Back button */}
          <div
            ref={(el) => {
              textRefs.current[3] = el;
            }}
            className="pt-4"
          >
            <button
              type="button"
              onClick={close}
              className="group inline-flex items-center gap-3 border border-white/30 px-6 py-3 font-sans text-[10px] tracking-[0.4em] uppercase transition-all duration-300 hover:border-white hover:bg-white hover:text-black"
            >
              <span className="transition-transform group-hover:-translate-x-1">←</span>
              <span>BACK TO GALLERY</span>
            </button>
          </div>
        </div>

        {/* right column: portrait contain image */}
        <div className="relative flex items-center justify-center p-6 md:p-10 min-h-[50vh] md:min-h-0 overflow-hidden">
          <div ref={imgWrapRef} className="relative h-full w-full flex items-center justify-center overflow-hidden">
            <img
              ref={imgRef}
              src={look.src}
              alt={styleTitle}
              draggable={false}
              className="max-h-[85vh] w-auto max-w-full object-contain will-change-transform drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
