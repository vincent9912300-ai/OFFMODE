import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [reduced] = useState(prefersReduced);
  const [lite] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const [ready, setReady] = useState(false);

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
    <div className="fixed inset-0 overflow-hidden bg-electric text-ink">
      <Navbar ready={ready} reduced={reduced} />

      <Hero ready={ready} reduced={reduced} lite={lite} />

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
    </div>
  );
}
