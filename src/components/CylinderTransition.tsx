import { useEffect, useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Renderer, Camera, Transform, Texture, Program, Mesh } from 'ogl';
import type { ParticleMesh } from '@/lib/cylinder/types';
import { cylinderConfig, particleConfig, imageConfig, perspectives } from '@/lib/cylinder/data';
import {
  drawImageContain,
  getPositionClasses,
  createCylinderGeometry,
  createParticleGeometry,
} from '@/lib/cylinder/utils';
import {
  cylinderVertex,
  cylinderFragment,
  particleVertex,
  particleFragment,
} from '@/lib/cylinder/shaders';
import { buildGalleryData } from '@/depth/galleryData';

type GallerySet = 'boy' | 'girl' | 'duo';

interface CylinderTransitionProps {
  /** 0 → 1 across the cinematic stage only (panels attached → panels fade) */
  progress: MotionValue<number>;
  set: GallerySet;
  reduced: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Piecewise camera path: [p, x, y, z] keyframes, eased between stops. */
const CAMERA_KEYS: [number, number, number, number][] = [
  [0.0, 0, 0, 8],
  [0.1, 0, 0, 8],
  [0.24, 0, 5, 5],
  [0.4, 1.5, 2, 2],
  [0.62, 0.5, 0, 0.8],
  [0.8, -6, -1, 8],
  [1.0, -6, -1, 8],
];

function cameraAt(p: number, restZ: number) {
  for (let i = 1; i < CAMERA_KEYS.length; i++) {
    const [p1, x1, y1, z1] = CAMERA_KEYS[i];
    if (p <= p1) {
      const [p0, x0, y0, z0] = CAMERA_KEYS[i - 1];
      const t = easeInOut(clamp01((p - p0) / Math.max(p1 - p0, 1e-6)));
      return {
        x: x0 + (x1 - x0) * t,
        y: y0 + (y1 - y0) * t,
        z: (z0 + (z1 - z0) * t) * (restZ / 8),
      };
    }
  }
  return { x: -6, y: -1, z: restZ };
}

function TextLine({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  const spec = perspectives[index];
  const [start, end] = spec.range;
  const ramp = (end - start) * 0.3;
  const opacity = useTransform(progress, [start, start + ramp, end - ramp, end], [0, 1, 1, 0]);
  const y = useTransform(progress, [start, end], [30, -30]);

  return (
    <motion.div
      style={{ opacity, y }}
      className={`absolute max-w-[85vw] text-center ${getPositionClasses(spec.position)}`}
    >
      <h2 className="select-none font-display text-[clamp(2rem,5vw,4.5rem)] leading-[0.88] uppercase -skew-x-6 text-white">
        {spec.title}
      </h2>
      {spec.description && (
        <p className="mt-3 font-sans text-[clamp(0.55rem,0.9vw,0.8rem)] tracking-[0.35em] uppercase text-electric/80">
          {spec.description}
        </p>
      )}
    </motion.div>
  );
}

export default function CylinderTransition({ progress, set, reduced }: CylinderTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const opacity = useTransform(progress, [0.03, 0.08, 0.9, 0.96], [0, 1, 1, 0]);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMobile = window.innerWidth < 768;
    const restZ = isMobile ? 10 : 8;

    const renderer = new Renderer({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
      alpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.CULL_FACE);

    const camera = new Camera(gl, { fov: isMobile ? 50 : 45, aspect: window.innerWidth / window.innerHeight });
    camera.position.set(0, 0, restZ);

    const scene = new Transform();

    const hardwareLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const safeLimit = isMobile ? 2048 : Math.min(hardwareLimit, 8192);

    const imgCanvas = document.createElement('canvas');
    const ctx = imgCanvas.getContext('2d', { alpha: false })!;

    const srcs = buildGalleryData(set).map((item) => item.textureSrc);
    const images: string[] = [];
    while (images.length < 12 && srcs.length) {
      images.push(srcs[images.length % srcs.length]);
    }

    const numImages = Math.max(images.length, 1);

    let cylinder: Mesh | null = null;
    const particles: ParticleMesh[] = [];
    let raf = 0;
    let disposed = false;
    const started = performance.now();

    // headless verification hook: proves the GL loop is running + textured
    const dbg = { ready: false, frames: 0, images: 0 };
    (globalThis as Record<string, unknown>).__cine = dbg;

    // scale the cylinder down so each look reads fully (no top/bottom crop)
    const fitScale = isMobile ? 0.82 : 0.88;

    let texture: Texture | null = null;

    const startRender = () => {
      const tick = () => {
        raf = requestAnimationFrame(tick);
        // a lost context can never be revived on this canvas (StrictMode,
        // GPU reset) — stop quietly instead of throwing every frame
        if (gl.isContextLost()) {
          cancelAnimationFrame(raf);
          return;
        }
        const p = clamp01(progress.get());
        dbg.frames++;
        const cam = cameraAt(p, restZ);

        camera.position.set(cam.x, cam.y, cam.z);
        camera.lookAt([0, 0, 0]);

        if (cylinder) {
          cylinder.rotation.y = 0.5 + p * 28.27;
        }

        const elapsed = (performance.now() - started) / 1000;
        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          const { baseAngle, speed, baseY } = particle.userData;
          particle.rotation.y = baseAngle + elapsed * 0.05 * speed;
          particle.rotation.x = Math.sin(elapsed * 0.2 * speed) * 0.15;
          particle.position.y = Math.sin(elapsed * 0.3 * speed) * baseY * 0.1;
          (particle.program.uniforms.uOpacity.value as number) =
            clamp01((p - 0.1) / 0.15) * (0.25 + 0.2 * Math.sin(elapsed * speed)) * (1 - clamp01((p - 0.85) / 0.1));
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        try {
          renderer.render({ scene, camera });
        } catch {
          cancelAnimationFrame(raf);
        }
      };
      tick();
    };

    const addParticles = (height: number) => {
      for (let i = 0; i < particleConfig.numParticles; i++) {
        const { geometry: lineGeometry, userData } = createParticleGeometry(
          gl,
          particleConfig,
          i,
          height,
        );
        const program = new Program(gl, {
          vertex: particleVertex,
          fragment: particleFragment,
          uniforms: {
            uColor: { value: [1.0, 1.0, 1.0] },
            uOpacity: { value: 0 },
          },
          transparent: true,
          depthTest: true,
        });
        const particle = new Mesh(gl, {
          geometry: lineGeometry,
          program,
          mode: gl.LINE_STRIP,
        }) as ParticleMesh;
        particle.userData = userData;
        particle.setParent(scene);
        particles.push(particle);
      }
    };

    let loaded = 0;
    const elements: HTMLImageElement[] = [];

    const buildCylinder = () => {
      // slice each look at its own aspect ratio (portrait) so nothing gets
      // cropped top/bottom — contain-draw into a portrait cell
      const first = elements.find(Boolean);
      const aspect =
        first && first.naturalWidth > 0 ? first.naturalWidth / first.naturalHeight : 0.75;
      const sliceW = imageConfig.width;
      const sliceH = Math.round(sliceW / Math.max(aspect, 0.4));
      const fullWidth = sliceW * numImages;
      const scale = Math.min(1, safeLimit / fullWidth);

      imgCanvas.width = Math.max(1, Math.floor(fullWidth * scale));
      imgCanvas.height = Math.max(1, Math.floor(sliceH * scale));
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);

      elements.forEach((img, i) => {
        const xStart = Math.floor((i / numImages) * imgCanvas.width);
        const xEndExact = Math.floor(((i + 1) / numImages) * imgCanvas.width);
        drawImageContain(ctx, img, xStart, 0, Math.max(1, xEndExact - xStart), imgCanvas.height);
      });

      // match cylinder height to the portrait slice so the texture is not
      // stretched either (height : circumference === cellH : fullWidth)
      const circumference = 2 * Math.PI * cylinderConfig.radius;
      const cylinderHeight = circumference * (sliceH / fullWidth);
      const geometry = createCylinderGeometry(gl, { ...cylinderConfig, height: cylinderHeight });

      texture = new Texture(gl, {
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        generateMipmaps: false,
      });
      texture.image = imgCanvas;
      texture.needsUpdate = true;

      const program = new Program(gl, {
        vertex: cylinderVertex,
        fragment: cylinderFragment,
        uniforms: {
          tMap: { value: texture },
          uDarkness: { value: 0 },
        },
        cullFace: null,
      });

      cylinder = new Mesh(gl, { geometry, program });
      cylinder.setParent(scene);
      cylinder.rotation.y = 0.5;
      cylinder.scale.set(fitScale, fitScale, fitScale);

      addParticles(cylinderHeight);
      dbg.images = numImages;
      dbg.ready = true;
      if (!disposed) startRender();
    };

    images.forEach((src, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (disposed) return;
        elements[index] = img;
        loaded++;
        if (loaded === numImages) buildCylinder();
      };
      img.onerror = () => {
        if (disposed) return;
        loaded++;
        if (loaded === numImages) buildCylinder();
      };
      img.src = src;
    });

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.perspective({
        fov: window.innerWidth < 768 ? 50 : 45,
        aspect: window.innerWidth / window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      particles.length = 0;
      cylinder = null;
      // NOTE: never call WEBGL_lose_context here — React StrictMode runs the
      // effect twice in dev and a lost context can't be re-acquired on the
      // same canvas, which left the whole screen white. Dropping the
      // references is enough; the browser reclaims the GL objects.
    };
  }, [progress, set, reduced]);

  if (reduced) return null;

  return (
    <motion.div
      id="cinematic-scroll"
      aria-hidden="true"
      style={{ opacity }}
      className="pointer-events-none absolute inset-0 z-[74]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-10">
        {perspectives.map((_, index) => (
          <TextLine key={index} index={index} progress={progress} />
        ))}
      </div>
    </motion.div>
  );
}
