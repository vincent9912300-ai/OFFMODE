import { useState } from 'react';
import { motion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import duoImg from '../assets/duo-cyberpunk.png';

interface SelectScreenProps {
  /** container scroll progress 0 → 1 */
  progress: MotionValue<number>;
  reduced: boolean;
}

type Side = 'left' | 'right';

/**
 * Screen two: revealed by a butter-smooth circular wipe that grows out of
 * the bottom-right corner as the page scrolls (Framer Motion spring on the
 * scroll progress drives the clip-path). Once the wipe completes, the
 * WEAR YOUR MOOD lockup fades in and the duo image becomes selectable —
 * left half / right half, purely visual selection, no gender labels.
 */
export default function SelectScreen({ progress, reduced }: SelectScreenProps) {
  // spring-smoothed progress: the wipe lags the wheel just enough to feel
  // buttery, then settles exactly where the scroll stopped
  const smooth = useSpring(progress,
    reduced
      ? { stiffness: 320, damping: 40, mass: 0.4 }
      : { stiffness: 140, damping: 27, mass: 0.65 },
  );

  const clipPath = useTransform(
    smooth,
    [0, 1],
    ['circle(0% at 100% 100%)', 'circle(150% at 100% 100%)'],
  );
  const contentOpacity = useTransform(smooth, [0.7, 0.98], [0, 1]);
  const contentY = useTransform(smooth, [0.7, 1], reduced ? [0, 0] : [46, 0]);

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
      aria-hidden="true"
      style={{ clipPath }}
      className="pointer-events-none fixed inset-0 z-[60] bg-[#0e0e0e]"
    >
      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="pointer-events-auto absolute inset-0"
      >
        {/* duo: two hit halves that together paint the one transparent PNG */}
        <div className="absolute left-1/2 top-1/2 w-[min(1180px,92vw)] -translate-x-[52%] -translate-y-1/2 aspect-[1672/941]">
          {half('left')}
          {half('right')}
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
