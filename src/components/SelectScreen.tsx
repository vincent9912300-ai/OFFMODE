import { type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useTransform, type MotionValue } from 'framer-motion';
import { CursorGrid } from '@/components/ui/cursor-grid';
import duoImg from '../assets/duo-cyberpunk.png';

interface SelectScreenProps {
  /** stage-one spring progress 0 → 1 (hero → this screen) */
  smooth: MotionValue<number>;
  /** stage-two spring progress 0 → 1 (this screen → depth gallery) */
  s2: MotionValue<number>;
  reduced: boolean;
  pick: Side | null;
  onPick: (side: Side) => void;
}

export type Side = 'left' | 'right';

/**
 * Screen two: revealed by a butter-smooth circular wipe that grows out of
 * the bottom-right corner as the page scrolls. Content fades in from a
 * blur once the circle nearly covers the viewport; the WEAR YOUR MOOD
 * lockup lands and the duo image becomes selectable — left half / right
 * half, purely visual selection, no gender labels. Everything is driven
 * by the shared spring, so scrolling back up plays the whole thing in
 * reverse.
 */
export default function SelectScreen({ smooth, s2, reduced, pick, onPick }: SelectScreenProps) {
  const clipPath = useTransform(
    smooth,
    [0, 1],
    ['circle(0% at 100% 100%)', 'circle(150% at 100% 100%)'],
  );
  const contentOpacity = useTransform(smooth, [0.7, 0.98], [0, 1]);
  const contentY = useTransform(smooth, [0.7, 1], reduced ? [0, 0] : [46, 0]);
  const contentBlur = useTransform(
    smooth,
    [0.6, 0.98],
    reduced ? ['blur(0px)', 'blur(0px)'] : ['blur(18px)', 'blur(0px)'],
  );
  // no hit-testing until the fade actually finished — and locked out again
  // the moment the bottom-left gallery wipe starts creeping in (page three
  // takes over the clicks from there)
  const contentPointer = useTransform([smooth, s2], ([v1, v2]: number[]) =>
    v1 > 0.97 && v2 < 0.1 ? 'auto' : 'none',
  );

  // The duo halves sit above the grid canvas, so their pointer events are
  // forwarded to the grid root (React listens at the document root, and the
  // dispatched event bubbles through it). A leave becomes a far-off move —
  // strength() is 0 beyond the radius, which clears the glow the same way.
  const forwardToGrid = (type: 'pointermove' | 'pointerdown' | 'pointerleave', e: ReactPointerEvent<HTMLDivElement>) => {
    const grid = document.getElementById('cursor-grid');
    if (!grid) return;
    const far = type === 'pointerleave';
    grid.dispatchEvent(
      new PointerEvent(far ? 'pointermove' : type, {
        clientX: far ? -9999 : e.clientX,
        clientY: far ? -9999 : e.clientY,
        bubbles: true,
      }),
    );
  };

  const half = (side: Side) => {
    const selected = pick === side;
    const dimmed = pick !== null && !selected;
    return (
      <button
        key={side}
        type="button"
        aria-label={side === 'left' ? 'Select left character' : 'Select right character'}
        aria-pressed={selected}
        onClick={() => onPick(side)}
        className={[
          'absolute inset-y-0 w-1/2 cursor-pointer rounded-[1.75rem] transition-all duration-500 ease-out outline-none',
          side === 'left' ? 'left-0 origin-left' : 'right-0 origin-right',
          dimmed ? 'opacity-35' : 'opacity-100',
          selected ? 'z-10 scale-[1.04]' : 'hover:opacity-90',
          selected ? 'focus-visible:ring-2 focus-visible:ring-electric/80' : '',
        ].join(' ')}
        style={{
          backgroundImage: `url(${duoImg})`,
          backgroundSize: '200% 100%',
          backgroundPosition: side === 'left' ? 'left center' : 'right center',
          backgroundRepeat: 'no-repeat',
          ...(selected
            ? {
                boxShadow:
                  '0 0 0 2px rgba(255, 229, 0, 0.85), 0 0 90px rgba(255, 229, 0, 0.16)',
              }
            : {}),
        }}
      />
    );
  };

  return (
    <motion.div
      id="select-screen"
      aria-hidden="true"
      style={{ clipPath }}
      className="pointer-events-none absolute inset-0 z-[60] bg-[#0e0e0e]"
    >
      <motion.div
        style={{ opacity: contentOpacity, y: contentY, filter: contentBlur, pointerEvents: contentPointer }}
        className="absolute inset-0"
      >
        {/* interactive pixel grid: painted first so the glow lives on the
            background only — the duo (transparent PNG) covers it where the
            characters are; events over the halves are forwarded to it */}
        <CursorGrid
          color="hsl(var(--primary))"
          cellSize={25}
          radius={150}
          id="cursor-grid"
        />

        {/* duo — full-bleed inside a 20px frame: fills the viewport height
            with a 20px breather from every edge/corner, sides crop on wide
            screens, width-fit on small ones */}
        <div
          id="duo-frame"
          onPointerMove={(e) => forwardToGrid('pointermove', e)}
          onPointerDown={(e) => forwardToGrid('pointerdown', e)}
          onPointerLeave={(e) => forwardToGrid('pointerleave', e)}
          className="absolute inset-5 flex items-center justify-center overflow-hidden"
        >
          <div className="relative aspect-[1672/941] h-full w-auto max-md:h-auto max-md:w-full">
            {half('left')}
            {half('right')}
          </div>
        </div>

        {/* selection label — only the picked character's name, animated
            in/out, parked on that character's own top corner (girl → top
            right of her half, boy → top left of his half) */}
        <div
          className={[
            'pointer-events-none absolute top-5 z-30 md:top-8',
            pick === 'right'
              ? 'right-5 md:right-12'
              : 'left-5 md:left-12',
          ].join(' ')}
        >
          <AnimatePresence>
            {pick && (
              <motion.p
                key={pick}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: -22, filter: 'blur(12px)' }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, filter: 'blur(0px)' }
                }
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: -14, filter: 'blur(12px)' }
                }
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="select-none font-display text-[clamp(2rem,5vw,4rem)] uppercase leading-none -skew-x-6 text-electric"
                style={{ textShadow: '0 0 48px rgba(255, 229, 0, 0.4)' }}
              >
                {pick === 'right' ? 'GIRL' : 'BOY'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* WEAR YOUR MOOD — white 60 / yellow 40, right corner */}
        <div className="pointer-events-none absolute bottom-10 right-8 z-20 select-none text-right md:bottom-14 md:right-14">
          <p className="font-display uppercase leading-[0.88] -skew-x-6">
            <span className="block text-[clamp(1.75rem,4.4vw,4rem)] text-white">
              WEAR YOUR
            </span>
            <span className="block text-[clamp(2.6rem,6.4vw,5.75rem)] text-electric">
              MOOD
            </span>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
