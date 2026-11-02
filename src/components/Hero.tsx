import WaterSurface from './WaterSurface';

interface HeroProps {
  ready: boolean;
  reduced: boolean;
  lite: boolean;
}

export default function Hero({ ready, reduced, lite }: HeroProps) {
  return (
    <main className="relative h-svh w-full overflow-hidden" id="offmode-hero">
      {/* GPU water: refracts the baked yellow + OFFMODE backdrop texture */}
      <WaterSurface ready={ready} reduced={reduced} lite={lite} />

      {/* premium glass pane over the water, under the navigation */}
      <div className="glass-layer" aria-hidden="true" />
    </main>
  );
}
