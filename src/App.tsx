import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'framer-motion';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import SelectScreen, { type Side } from './components/SelectScreen';
import LookDetail, { type OpenLook } from './components/LookDetail';
import DepthGallery from './depth/DepthGallery';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [reduced] = useState(prefersReduced);
  const [lite] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const [ready, setReady] = useState(false);
  // character pick lives up here so screen three can show the matching set
  const [pick, setPick] = useState<Side | null>(null);
  // kinetic look detail — open when a resting plane is clicked
  const [openLook, setOpenLook] = useState<OpenLook | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // freeze the gallery underneath while the detail view is open
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (openLook) {
      el.style.overflowY = 'hidden';
      return () => {
        el.style.overflowY = '';
      };
    }
  }, [openLook]);

  // scroll range for the two round wipes (screen two → screen three)
  const { scrollYProgress } = useScroll({ container: scrollRef });

  // one spring shared by all screens so the cross-fades stay perfectly in
  // sync (and play identically when the scroll reverses)
  const smooth = useSpring(
    scrollYProgress,
    reduced
      ? { stiffness: 320, damping: 40, mass: 0.4 }
      : { stiffness: 140, damping: 27, mass: 0.65 },
  );

  // stage one (first ~250vh): hero → select — all original ranges kept
  const s1 = useTransform(smooth, [0, 0.2], [0, 1]);
  // stage two (rest of ~1000vh): select → depth gallery, wipe from
  // bottom-left — a long runway so every look gets its own screen of
  // scroll (checkpoints) and fast flicks can't blast through the stack
  const s2 = useTransform(smooth, [0.2, 1], [0, 1]);

  // screen one: fades + blurs out while the black circle grows over it
  const heroOpacity = useTransform(s1, [0.1, 0.62], [1, 0]);
  const heroFilter = useTransform(
    s1,
    [0.1, 0.62],
    reduced ? ['blur(0px)', 'blur(0px)'] : ['blur(0px)', 'blur(16px)'],
  );
  const heroScale = useTransform(s1, [0, 0.62], reduced ? [1, 1] : [1, 1.06]);
  const heroPointer = useTransform(s1, (v) =>
    v > 0.55 ? 'none' : 'auto',
  );

  const handlePick = (side: Side) =>
    setPick((p) => (p === side ? null : side));

  // headless verification hook: raw + spring-smoothed scroll progress
  (globalThis as Record<string, unknown>).__scroll = {
    raw: scrollYProgress,
    smooth,
  };

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
      {/* four screens of scroll: hero → select wipe, select → gallery wipe */}
      <div className="relative h-[1250vh]">
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
          <SelectScreen
            smooth={s1}
            s2={s2}
            reduced={reduced}
            pick={pick}
            onPick={handlePick}
          />

          {/* screen three — Codrops depth gallery, wipe out of the
              bottom-left corner, showing the picked character's set */}
          <DepthGallery
            s2={s2}
            set={pick === 'left' ? 'boy' : pick === 'right' ? 'girl' : 'duo'}
            reduced={reduced}
            onOpenLook={setOpenLook}
          />
        </div>

        {/* kinetic look detail — overlays everything, reverses on close */}
        <AnimatePresence>
          {openLook && (
            <LookDetail
              key={openLook.src}
              look={openLook}
              reduced={reduced}
              onClose={() => setOpenLook(null)}
            />
          )}
        </AnimatePresence>

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
