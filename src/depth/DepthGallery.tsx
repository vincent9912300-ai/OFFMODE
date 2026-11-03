import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useTransform, type MotionValue } from 'framer-motion';
import * as THREE from 'three';
import { Gallery } from '@/depth/Gallery';
import { Background } from '@/depth/Background';
import { buildGalleryData, imageSets } from '@/depth/galleryData';
import type { OpenLook } from '@/components/LookDetail';

type GallerySet = 'boy' | 'girl' | 'duo';

interface DepthGalleryProps {
  /** stage-two spring progress: 0 = page two settled, 1 = gallery end */
  s2: MotionValue<number>;
  set: GallerySet;
  reduced: boolean;
  /** fired when the user clicks the plane that's currently resting */
  onOpenLook: (look: OpenLook) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// one Texture per source, shared across set switches (duo lives in both
// character galleries) — swapping the pick rebuilds planes instantly
const texCache = new Map<string, THREE.Texture>();
let texPromise: Promise<void> | null = null;

const loadAllTextures = () => {
  if (!texPromise) {
    const loader = new THREE.TextureLoader();
    const sources = [...new Set(Object.values(imageSets).flat())];
    texPromise = Promise.all(
      sources.map(async (src) => {
        if (texCache.has(src)) return;
        const texture = await loader.loadAsync(src);
        texture.colorSpace = THREE.SRGBColorSpace;
        texCache.set(src, texture);
      }),
    ).then(() => undefined);
  }
  return texPromise;
};

/**
 * Screen three — the Codrops Atmospheric Depth Gallery, driven by the same
 * shared spring. The black layer sits under the transition panels (see
 * TransitionPanels) and the look images only fade in once those panels have
 * attached, then the camera dives through the selected look stack (boy/girl
 * + duo on both, duo alone when nothing was picked) with mood backgrounds
 * per image. The layer stays non-interactive (parallax listens on window),
 * taking over the clicks once it is fully visible so page two can't be hit
 * through it.
 */
export default function DepthGallery({
  s2,
  set,
  reduced,
  onOpenLook,
}: DepthGalleryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // latest callback without re-running the WebGL effect
  const openRef = useRef(onOpenLook);
  openRef.current = onOpenLook;

  // in scrolling only display style
  const [activeLook, setActiveLook] = useState<{
    title: string;
    accent: string;
    index: number;
    x: number;
  } | null>(null);

  // black bed under the transition panels — pure dark, no wipe shape
  const layerOpacity = useTransform(s2, [0.04, 0.16], [0, 1]);
  // page three opens from the centre: a circular mask grows outward from
  // the middle of the screen once the cinematic scroll has finished
  const contentClip = useTransform(
    s2,
    [0.12, 0.3],
    ['circle(0% at 50% 50%)', 'circle(150% at 50% 50%)'],
  );
  const contentOpacity = useTransform(s2, [0.12, 0.28], [0, 1]);
  const contentBlur = useTransform(
    s2,
    [0.12, 0.28],
    reduced ? ['blur(0px)', 'blur(0px)'] : ['blur(18px)', 'blur(0px)'],
  );
  const contentPointer = useTransform(s2, (v) =>
    v > 0.3 ? 'auto' : 'none',
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let raf = 0;
    let gallery: Gallery | null = null;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const scene = new THREE.Scene();
    const background = new Background(null);
    background.init();

    let maxZ = 0;
    let minZ = -1;
    const scrollState: { velocity: number; velocityMax: number } = {
      velocity: 0,
      velocityMax: 1.5,
    };
    let lastS2 = s2.get();
    let vel = 0;

    // runtime introspection for headless probes (harmless in production)
    (globalThis as Record<string, unknown>).__dg = {
      camera,
      s2,
      scrollState,
      get gallery() {
        return gallery;
      },
    };

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth || 1;
      const h = canvas.clientHeight || window.innerHeight || 1;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      gallery?.updatePlaneScale();
      gallery?.layoutPlanes();
    };

    const build = async () => {
      await loadAllTextures();
      if (cancelled) return;
      const g = new Gallery(null);
      g.planeConfig = buildGalleryData(set);
      g.setPreloadedTextures(texCache);
      await g.init(scene);
      if (cancelled) return;
      const range = g.getDepthRange();
      // rest distance MUST equal planeGap: the fade/mood sampling looks
      // exactly one gap ahead of the camera, so sitting one gap in front
      // of a plane puts that plane at blend 0 (fully at rest)
      maxZ = range.nearestZ + g.planeGap;
      minZ = range.deepestZ + g.planeGap;
      camera.position.z = maxZ;
      gallery = g;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = s2.get();
      const raw = Math.max(-1.5, Math.min(1.5, (v - lastS2) * 100));
      lastS2 = v;
      vel += (raw - vel) * 0.12;
      scrollState.velocity = reduced ? 0 : vel;
      if (!gallery) return;

      // checkpoint depth: every look gets its own stretch of scroll, the
      // FIRST look gets double (so it can never streak away unseen), and
      // travel between planes eases over the middle half of the segment
      // with plateaus at both ends — plus a temporal lerp on top so even
      // violent flicks glide to a soft stop instead of snapping.
      const depthT = clamp01((v - 0.43) / 0.57);
      const n = gallery.planes.length;
      let targetZ = maxZ;
      if (n > 1) {
        const span = n - 1;
        // segment weights: look 01 = 2 units, the rest = 1 unit each
        const total = span + 1;
        const idx = depthT * total;
        let i = 0;
        let segStart = 0;
        while (i < span) {
          const w = i === 0 ? 2 : 1;
          if (idx <= segStart + w || i === span - 1) {
            const f = Math.min((idx - segStart) / w, 1);
            const move = clamp01((f - 0.25) / 0.5);
            const eased = move * move * (3 - 2 * move);
            targetZ = maxZ + (minZ - maxZ) * ((i + eased) / span);
            break;
          }
          segStart += w;
          i += 1;
        }
      }
      camera.position.z += (targetZ - camera.position.z) * (reduced ? 1 : 0.14);

      gallery.update(camera, scrollState);

      const blendData = gallery.getPlaneBlendData(camera.position.z);
      const mood = gallery.getMoodBlendData(camera.position.z);
      if (mood) background.setMoodBlend(mood);

      const depthProgress = gallery.getDepthProgress(camera.position.z);
      const velocityIntensity = Math.min(
        Math.abs(scrollState.velocity) / scrollState.velocityMax,
        1,
      );
      const blend = blendData?.blend ?? 0;
      const stability = THREE.MathUtils.smoothstep(
        Math.abs(blend - 0.5) * 2,
        0.35,
        1,
      );
      background.setMotionResponse({
        depthProgress,
        velocityIntensity: velocityIntensity * stability,
      });
      background.update(performance.now());

      // track active resting look to display style in scrolling
      if (gallery.planes.length > 0 && blendData) {
        const activeIdx =
          blendData.blend < 0.5 ? blendData.currentPlaneIndex : blendData.nextPlaneIndex;
        if (activeIdx !== lastActiveIdx && gallery.planeConfig[activeIdx]) {
          lastActiveIdx = activeIdx;
          const cfg = gallery.planeConfig[activeIdx] as any;
          setActiveLook({
            title: cfg.title || cfg.label?.word || `Look ${activeIdx + 1}`,
            accent: cfg.accentColor || '#ffe500',
            index: activeIdx,
            x: cfg.position?.x ?? 0,
          });
        }
      }

      renderer.clear(true, true, true);
      background.render(renderer);
      renderer.clearDepth();
      renderer.render(scene, camera);
    };

    let lastActiveIdx = -1;

    // --- kinetic open: click a resting plane to open its detail view -----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pointerFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const hitPlane = (e: PointerEvent) => {
      if (!gallery || s2.get() < 0.38) return null;
      pointerFromEvent(e);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(gallery.planes, false);
      if (!hits.length) return null;
      // only a plane the camera RESTS on — blend ≈ 0 means it sits on the
      // current plane, blend ≈ 1 means it has effectively arrived at the
      // next one; anything in between is mid-travel (ghost planes). The
      // previous plane sits AT the camera and can steal the nearest hit,
      // so find the resting plane anywhere in the hit list instead.
      const blend = gallery.getPlaneBlendData(camera.position.z);
      if (!blend) return null;
      const resting =
        blend.blend <= 0.1
          ? blend.currentPlaneIndex
          : blend.blend >= 0.9
            ? blend.nextPlaneIndex
            : -1;
      if (resting < 0) return null;
      const hit = hits.find(
        (h) => (h.object.userData.planeIndex as number | undefined) === resting,
      );
      if (!hit) return null;
      return { index: resting, blend };
    };
    const onPointerMove = (e: PointerEvent) => {
      canvas.style.cursor = hitPlane(e) ? 'pointer' : '';
    };
    const onClick = (e: PointerEvent) => {
      const hit = hitPlane(e);
      if (!hit || !gallery) return;
      const cfg = gallery.planeConfig[hit.index] as any;
      openRef.current({
        src: cfg.textureSrc,
        index: hit.index,
        hero: cfg.hero || '',
        title: cfg.title || cfg.label?.word || `Look ${hit.index + 1}`,
        word: cfg.label?.word || cfg.title || `Look ${hit.index + 1}`,
        details: cfg.details || '',
        palette: cfg.palette || '',
        accent: cfg.accentColor || '#ffe500',
        paletteColors: cfg.paletteColors || [],
      });
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onClick);

    window.addEventListener('resize', resize);
    resize();
    build();
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onClick);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          materials.forEach((m) => m?.dispose());
        }
      });
      scene.clear();
      background.dispose();
      renderer.dispose();
    };
    // textures live in texCache on purpose — never disposed here
  }, [set, reduced, s2]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{ opacity: layerOpacity }}
        className="pointer-events-none absolute inset-0 z-[76] bg-[#0e0e0e]"
      />
      <motion.div
        id="gallery-screen"
        aria-hidden="true"
        style={{ pointerEvents: contentPointer }}
        className="pointer-events-none absolute inset-0 z-[78]"
      >
        <motion.div
          style={{ opacity: contentOpacity, filter: contentBlur, clipPath: contentClip }}
          className="absolute inset-0"
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </motion.div>

        {/* in scrolling only display style */}
        <AnimatePresence mode="wait">
          {activeLook && (
            <motion.div
              key={activeLook.index}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(8px)' }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, filter: 'blur(8px)' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ opacity: contentOpacity }}
              className={`pointer-events-none absolute bottom-8 z-30 flex flex-col px-6 md:px-14 ${
                activeLook.x < 0
                  ? 'right-0 items-end text-right'
                  : activeLook.x > 0
                    ? 'left-0 items-start text-left'
                    : 'inset-x-0 items-center text-center'
              }`}
            >
              <span className="font-sans text-[10px] tracking-[0.45em] uppercase text-white/40 mb-1.5">
                STYLE
              </span>
              <h3
                className="font-display text-[clamp(1.4rem,3.2vw,2.8rem)] uppercase leading-none tracking-tight -skew-x-2 drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] max-w-[85vw]"
                style={{
                  color: activeLook.accent,
                  textShadow: `0 0 35px ${activeLook.accent}50`,
                }}
              >
                {activeLook.title}
              </h3>
              <span className="mt-2.5 font-sans text-[9px] tracking-[0.35em] uppercase text-white/40">
                CLICK LOOK FOR FULL DETAILS
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
