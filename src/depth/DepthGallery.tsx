import { useEffect, useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import * as THREE from 'three';
import { Gallery } from '@/depth/Gallery';
import { Background } from '@/depth/Background';
import { buildGalleryData, imageSets } from '@/depth/galleryData';

type GallerySet = 'boy' | 'girl' | 'duo';

interface DepthGalleryProps {
  /** stage-two spring progress: 0 = page two settled, 1 = gallery end */
  s2: MotionValue<number>;
  set: GallerySet;
  reduced: boolean;
  /** fired when the user clicks the plane that's currently resting */
  onOpenLook: (look: { src: string; word: string; index: number }) => void;
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
 * shared spring: its circle wipes out of the BOTTOM-LEFT corner, then the
 * camera dives through the selected look stack (boy/girl + duo on both,
 * duo alone when nothing was picked) with mood backgrounds per image.
 * The layer stays non-interactive (parallax listens on window), taking
 * over the clicks so page two can't be hit through it.
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

  const clipPath = useTransform(
    s2,
    [0.1, 0.22],
    ['circle(0% at 0% 100%)', 'circle(165% at 0% 100%)'],
  );
  // the wipe paints pure black first; the images only display once the
  // screen is fully covered — and the depth dive starts on that same beat,
  // so there is never a black stretch where scrolling does nothing
  const contentOpacity = useTransform(s2, [0.22, 0.38], [0, 1]);
  const contentBlur = useTransform(
    s2,
    [0.22, 0.38],
    reduced ? ['blur(0px)', 'blur(0px)'] : ['blur(18px)', 'blur(0px)'],
  );
  const contentPointer = useTransform(s2, (v) =>
    v > 0.38 ? 'auto' : 'none',
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
    const scrollState = { velocity: 0, velocityMax: 1.5 };
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

      renderer.clear(true, true, true);
      background.render(renderer);
      renderer.clearDepth();
      renderer.render(scene, camera);
    };

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
      const cfg = gallery.planeConfig[hit.index];
      openRef.current({
        src: cfg.textureSrc,
        word: cfg.label?.word || `look ${hit.index + 1}`,
        index: hit.index,
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
    <motion.div
      id="gallery-screen"
      aria-hidden="true"
      style={{ clipPath, pointerEvents: contentPointer }}
      className="pointer-events-none absolute inset-0 z-[70] bg-[#0e0e0e]"
    >
      <motion.div
        style={{ opacity: contentOpacity, filter: contentBlur }}
        className="absolute inset-0"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </motion.div>
    </motion.div>
  );
}
