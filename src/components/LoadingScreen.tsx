import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface LoadingScreenProps {
  onComplete: () => void;
  reduced: boolean;
}

export default function LoadingScreen({ onComplete, reduced }: LoadingScreenProps) {
  const barRef = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  const finish = () => {
    if (!done.current) {
      done.current = true;
      onComplete();
    }
  };

  useEffect(() => {
    // advance the progress bar; complete after a minimum brand moment
    if (reduced) {
      const t = window.setTimeout(finish, 350);
      return () => window.clearTimeout(t);
    }
    const tl = gsap.timeline();
    tl.fromTo(
      barRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 1.1, ease: 'power2.inOut', onComplete: finish },
    );
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ink">
      <p className="mb-6 font-display text-xs tracking-[0.55em] text-electric md:text-sm">
        OFFMODE
      </p>
      <div className="h-px w-40 overflow-hidden bg-white/15 md:w-56">
        <span
          ref={barRef}
          className="block h-full w-full origin-left scale-x-0 bg-electric"
        />
      </div>
      <p className="mt-6 font-sans text-[9px] tracking-[0.45em] text-electric/60">
        WEAR YOUR MOOD
      </p>
    </div>
  );
}
