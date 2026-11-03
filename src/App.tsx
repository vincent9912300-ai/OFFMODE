import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'framer-motion';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import SelectScreen, { type Side } from './components/SelectScreen';
import TransitionPanels from './components/TransitionPanels';
import CylinderTransition from './components/CylinderTransition';
import LookDetail, { type OpenLook } from './components/LookDetail';
import DepthGallery from './depth/DepthGallery';
import AboutPage from './components/AboutPage';
import StaticWebsite from './components/StaticWebsite';

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
  // toggle between 3D scroll experience and normal static website
  const [isStaticMode, setIsStaticMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isJ = e.key === 'j' || e.key === 'J' || e.code === 'KeyJ';
      if (isJ && (e.metaKey || e.altKey || (e.ctrlKey && e.shiftKey))) {
        e.preventDefault();
        setIsStaticMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


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

  // stage one (first ~260vh): hero → select
  const s1 = useTransform(smooth, [0, 0.13], [0, 1]);
  // stage two (~240vh): the four black/yellow panels attach and connect
  const panelsP = useTransform(smooth, [0.2, 0.32], [0, 1]);
  // stage three (~560vh): cinematic cylinder scroll over the blurred collage
  const cineP = useTransform(smooth, [0.3, 0.58], [0, 1]);
  // stage four (~520vh): the old depth gallery, revealed from the centre
  const galleryP = useTransform(smooth, [0.58, 0.78], [0, 1]);
  // stage five (~520vh): the yellow about page after the last look settles
  const aboutP = useTransform(smooth, [0.8, 1], [0, 1]);

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

  const goToStage = (label: string) => {
    const el = scrollRef.current;
    if (!el) return;
    const frac =
      label === 'about' ? 0.9 : label === 'styles' ? 0.76 : label === 'collections' ? 0.66 : 0;
    el.scrollTo({ top: frac * (el.scrollHeight - el.clientHeight), behavior: 'smooth' });
  };

  // headless verification hook: raw + spring-smoothed scroll progress
  (globalThis as Record<string, unknown>).__scroll = {
    raw: scrollYProgress,
    smooth,
    s1,
    panels: panelsP,
    cine: cineP,
    gallery: galleryP,
    about: aboutP,
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
    <div className="fixed inset-0 bg-electric text-ink overflow-hidden">
      {isStaticMode ? (
        <div className="h-full w-full overflow-y-auto">
          <StaticWebsite onOpenLook={setOpenLook} />
        </div>
      ) : (
        <div
          ref={scrollRef}
          id="app-scroll"
          className={`h-full w-full no-scrollbar ${
            ready ? 'overflow-y-auto' : 'overflow-hidden'
          }`}
        >
          {/* six screens of scroll: hero → panels → cinematic → gallery dive → about */}
          <div className="relative h-[2600vh]">
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
                <Navbar ready={ready} reduced={reduced} onSelectLink={goToStage} />
                <Hero ready={ready} reduced={reduced} lite={lite} />

                {/* tagline sits low-left — one small editorial accent */}
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
                s2={panelsP}
                reduced={reduced}
                pick={pick}
                onPick={handlePick}
              />

              {/* screen two → three hand-off — four panels connect */}
              <TransitionPanels s2={panelsP} reduced={reduced} />

              {/* cinematic cylinder scroll */}
              <CylinderTransition
                progress={cineP}
                set={pick === 'left' ? 'boy' : pick === 'right' ? 'girl' : 'duo'}
                reduced={reduced}
              />

              {/* screen three — Codrops depth gallery showing the picked set */}
              <DepthGallery
                s2={galleryP}
                set={pick === 'left' ? 'boy' : pick === 'right' ? 'girl' : 'duo'}
                reduced={reduced}
                onOpenLook={setOpenLook}
              />

              {/* screen four — final page: yellow, interactive type cylinder with venom goo */}
              <AboutPage progress={aboutP} reduced={reduced} />
            </div>
          </div>
        </div>
      )}

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

      {/* initial loading screen */}
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
  );
}
