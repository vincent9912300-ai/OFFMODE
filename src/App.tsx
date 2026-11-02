import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'framer-motion';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import SelectScreen from './components/SelectScreen';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [reduced] = useState(prefersReduced);
  const [lite] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // scroll range for the round yellow → matte-black wipe (screen two)
  const { scrollYProgress } = useScroll({ container: scrollRef });

  // one spring shared by both screens so the cross-fade stays perfectly in
  // sync (and plays identically when the scroll reverses)
  const smooth = useSpring(
    scrollYProgress,
    reduced
      ? { stiffness: 320, damping: 40, mass: 0.4 }
      : { stiffness: 140, damping: 27, mass: 0.65 },
  );

  // screen one: fades + blurs out while the black circle grows over it
  const heroOpacity = useTransform(smooth, [0.1, 0.62], [1, 0]);
  const heroFilter = useTransform(
    smooth,
    [0.1, 0.62],
    reduced ? ['blur(0px)', 'blur(0px)'] : ['blur(0px)', 'blur(16px)'],
  );
  const heroScale = useTransform(smooth, [0, 0.62], reduced ? [1, 1] : [1, 1.06]);
  const heroPointer = useTransform(smooth, (v) =>
    v > 0.55 ? 'none' : 'auto',
  );

  // if the viewport crosses the lite threshold mid-session, reload the pass
  useEffect(() => {
    const onResize = () => {
      const shouldLite = window.innerWidth < 768;
      if (shouldLite !== lite) {
        window.location.reload();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [lite]);

  return (
    <div
      ref={scrollRef}
      id="app-scroll"
      className={`fixed inset-0 bg-electric text-ink no-scrollbar ${
        ready ? 'overflow-y-auto' : 'overflow-hidden'
      }`}
    >
      {/* two screens of scroll: 100vh of wipe */}
      <div className="relative h-[200vh]">
        {/* ONE sticky screen holding both layers: they always share the
            exact viewport rect, so the wipe circle anchors to the bottom-
            right corner at every scroll position (a second sticky sibling
            slid in from below and sliced the circle with a straight edge).
            Staying in-flow keeps wheel events chaining to #app-scroll so
            reverse scroll works. */}
        <div className="sticky top-0 h-svh overflow-hidden">
          <motion.div
            id="hero-screen"
            style={{
              opacity: heroOpacity,
              filter: heroFilter,
              scale: heroScale,
              pointerEvents: heroPointer,
            }}
            className="absolute inset-0"
          >
            <Navbar ready={ready} reduced={reduced} />
            <Hero ready={ready} reduced={reduced} lite={lite} />

            {/* tagline sits low-left — one small editorial accent, nothing more */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: ready && !reduced ? 1 : 0 }}
              transition={{ delay: 1.9, duration: 0.8 }}
              className="pointer-events-none absolute bottom-6 left-6 z-30 hidden text-left font-sans text-[10px] leading-relaxed tracking-[0.35em] md:block"
            >
              WEAR YOUR MOOD
              <span className="mt-1 block opacity-50">FW26 / SYSTEM:OFFMODE</span>
            </motion.p>
          </motion.div>

          {/* screen two — round wipe from the bottom-right corner */}
          <SelectScreen smooth={smooth} reduced={reduced} />
        </div>

        <AnimatePresence>
          {!ready && (
            <motion.div
              key="loader"
              exit={reduced ? { opacity: 0 } : { y: '-100%' }}
              transition={{ duration: reduced ? 0.2 : 0.65, ease: [0.83, 0, 0.17, 1] }}
            >
              <LoadingScreen onComplete={() => setReady(true)} reduced={reduced} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
