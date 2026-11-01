import { lazy, Suspense } from 'react';
import BrandWordmark from './BrandWordmark';
import { useMousePosition } from '../hooks/useMousePosition';

const LiquidBackground = lazy(() => import('./LiquidBackground'));

interface HeroProps {
  ready: boolean;
  reduced: boolean;
  lite: boolean;
}

export default function Hero({ ready, reduced, lite }: HeroProps) {
  const mouseRef = useMousePosition();

  return (
    <main className="relative h-svh w-full overflow-hidden" id="offmode-hero">
      {/* heavy graphics are lazy-loaded in parallel with the loading screen */}
      <Suspense fallback={null}>
        <LiquidBackground ready={ready} reduced={reduced} lite={lite} mouseRef={mouseRef} />
      </Suspense>

      <BrandWordmark ready={ready} reduced={reduced} mouseRef={mouseRef} />
    </main>
  );
}
