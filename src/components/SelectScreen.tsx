import { useState } from 'react';
import { AnimatePresence, motion, useTransform, type MotionValue } from 'framer-motion';
import duoImg from '../assets/duo-cyberpunk.png';

interface SelectScreenProps {
  /** spring-smoothed scroll progress 0 → 1, shared with screen one */
  smooth: MotionValue<number>;
  reduced: boolean;
}

type Side = 'left' | 'right';

/**
 * Screen two: revealed by a butter-smooth circular wipe that grows out of
 * the bottom-right corner as the page scrolls. Content fades in from a
 * blur once the circle nearly covers the viewport; the WEAR YOUR MOOD
 * lockup lands and the duo image becomes selectable — left half / right
 * half, purely visual selection, no gender labels. Everything is driven
 * by the shared spring, so scrolling back up plays the whole thing in
 * reverse.
 */
export default function SelectScreen({ smooth, reduced }: SelectScreenProps) {
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
  // no hit-testing until the fade actually finished (also keeps the
  // reverse scroll clean — nothing clickable while the wipe shrinks back)
  const contentPointer = useTransform(smooth, (v) =>
    v > 0.97 ? 'auto' : 'none',
  );

  const [pick, setPick] = useState<Side | null>(null);

  const half = (side: Side) => {
    const selected = pick === side;
    const dimmed = pick !== null && !selected;
    return (
      <button
        key={side}
        type="button"
        aria-label={side === 'left' ? 'Select left character' : 'Select right character'}
        aria-pressed={selected}
        onClick={() => setPick((p) => (p === side ? null : side))}
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
        {/* duo — full-bleed: fills the viewport height (no bottom gap),
            sides crop on wide screens, width-fit on small ones */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="relative aspect-[1672/941] h-full w-auto max-md:h-auto max-md:w-[92vw]">
            {half('left')}
            {half('right')}
          </div>
        </div>

        {/* selection label — only the picked character's name, animated
            in/out, parked on that character's own top corner (girl → top
            right of her half, boy → top left of his half) */}
        <div
          className={[
            'absolute top-5 z-30 md:top-8',
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
        <div className="absolute bottom-10 right-8 z-20 select-none text-right md:bottom-14 md:right-14">
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
