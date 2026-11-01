import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MousePos } from '../hooks/useMousePosition';
import { gsap } from 'gsap';

/* ------------------------------------------------------------------ */
/* GLSL                                                                */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;   // seconds, frozen for reduced motion
uniform float uAmp;    // 1 = full motion, 0 = static (reduced motion)
uniform float uLite;   // 1 = mobile / simplified pass
uniform vec2  uMouse;  // smoothed normalized pointer, -1..1
uniform vec2  uRes;    // css pixel size

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;

  // pointer-reactive offset (subtle, lerped on the CPU side)
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  p += uMouse * vec2(0.035, 0.025);

  float t = uTime;
  float aa = 1.5 / max(uRes.y, 720.0);

  // electric yellow base (#FFE500)
  vec3 col = vec3(1.0, 0.898, 0.0);

  // dim ribbons toward the horizontal center so the wordmark stays readable
  float cx = 0.3 + 0.7 * smoothstep(0.10, 0.45, abs(uv.x - 0.5));

  /* ---- flowing black liquid ribbons ---- */
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (uLite > 0.5 && fi > 0.5 && fi < 1.5) continue; // skip middle ribbon on mobile

    float y0 = 0.38 - fi * 0.38; // 0.38 / 0.0 / -0.38

    float yc = y0
      + (sin(p.x * 1.6 + fi * 2.3 + t * 0.9) * 0.055
      +  sin(p.x * 2.9 - t * 0.55 + fi * 1.4) * 0.028
      + (fbm(vec2(p.x * 1.25 + t * 0.32, fi * 3.7)) - 0.5) * 0.24) * uAmp;
    yc = clamp(yc, -0.46, 0.41); // never crowd the navbar / bottom edge

    float halfW = 0.048 * (0.5 + 0.9 * fbm(vec2(p.x * 2.1 - t * 0.38, fi * 7.3)));
    float d = abs(p.y - yc);

    float mask = 1.0 - smoothstep(halfW, halfW + aa, d);
    if (fi > 0.5 && fi < 1.5) {
      float cy = 0.55 + 0.45 * smoothstep(0.08, 0.26, abs(uv.y - 0.5));
      mask *= cx * cy;
    } else {
      mask *= cx;
    }
    if (mask < 0.004) continue;

    // pseudo-chrome shading: bright rims, a top catch-light and a travelling sheen
    float edge = clamp((p.y - yc) / halfW, -1.0, 1.0);
    float rim = pow(abs(edge), 7.0);
    float cup = smoothstep(0.45, 0.95, edge);
    float sheen = pow(max(sin(p.x * 2.6 - t * 0.9 + fi * 2.1), 0.0), 9.0);

    vec3 lc = mix(vec3(0.015), vec3(0.85, 0.85, 0.83), clamp(rim * 0.55 + cup * 0.35, 0.0, 1.0));
    col = mix(col, lc, mask);
    col += mask * sheen * vec3(1.0, 0.99, 0.9) * 0.22;
  }

  /* ---- small glossy droplets ---- */
  if (uLite < 0.5) {
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float sx = hash21(vec2(fj * 12.9898, 4.1414));
      float sy = hash21(vec2(fj * 3.7, 8.27));
      float sf = hash21(vec2(fj * 7.9, 2.13));

      vec2 cp = vec2(
        (sx - 0.5) * aspect * 0.9 + sin(t * (0.35 + 0.2 * sy) + fj * 2.4) * 0.06,
        sy * 0.9 - 0.45 + cos(t * 0.5 + fj * 3.1) * 0.05
      );
      float r = 0.006 + 0.013 * sf;

      vec2 dp = (p - cp) / vec2(1.0, 1.25); // slight vertical squash for weight
      float dd = length(dp);
      float dm = 1.0 - smoothstep(r, r + aa, dd);
      col = mix(col, vec3(0.02), dm);

      // tiny specular bead offset toward the upper-left
      vec2 hp = (p - (cp - vec2(r * 0.35, r * 0.35))) / vec2(1.0, 1.25);
      float hl = 1.0 - smoothstep(0.0, r * 0.45, length(hp));
      col += dm * hl * 0.85;
    }
  }

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* WebGL capability check                                              */
/* ------------------------------------------------------------------ */

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Three.js plane                                                      */
/* ------------------------------------------------------------------ */

interface LiquidPlaneProps {
  reduced: boolean;
  lite: boolean;
  mouseRef: React.MutableRefObject<MousePos>;
}

function LiquidPlane({ reduced, lite, mouseRef }: LiquidPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetMouse = useRef(new THREE.Vector2(0, 0));
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: reduced ? 0 : 1 },
      uLite: { value: lite ? 1 : 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uRes: { value: new THREE.Vector2(1, 1) },
    }),
    // uniforms are stable for the lifetime of the plane
    [] , // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (!mat) return;

    if (!reduced) {
      uniforms.uTime.value += Math.min(delta, 1 / 20);
    }
    uniforms.uRes.value.set(size.width, size.height);

    // smooth the raw pointer ref into the uniform (no React state involved)
    targetMouse.current.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.uMouse.value.lerp(targetMouse.current, reduced ? 0 : 0.055);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* CSS fallback for machines without WebGL                             */
/* ------------------------------------------------------------------ */

function CssLiquidFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="css-blob css-blob-a" />
      <div className="css-blob css-blob-b" />
      <div className="css-blob css-blob-c" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface LiquidBackgroundProps {
  ready: boolean;
  reduced: boolean;
  lite: boolean;
  mouseRef: React.MutableRefObject<MousePos>;
}

export default function LiquidBackground({
  ready,
  reduced,
  lite,
  mouseRef,
}: LiquidBackgroundProps) {
  const [hasGL] = useState(supportsWebGL);
  const [hidden, setHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // pause the render loop completely while the tab is hidden
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // fade the liquid in as part of the intro choreography
  useEffect(() => {
    if (!containerRef.current || !ready) return;
    if (reduced) {
      gsap.set(containerRef.current, { opacity: 1 });
      return;
    }
    gsap.to(containerRef.current, {
      opacity: 1,
      duration: 1.2,
      delay: 0.15,
      ease: 'power2.out',
    });
  }, [ready, reduced]);

  if (!hasGL) return <CssLiquidFallback />;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ opacity: 0 }}
      data-testid="liquid-background"
    >
      <Canvas
        frameloop={hidden ? 'never' : 'always'}
        dpr={[1, lite ? 1.25 : 1.75]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 1] }}
      >
        <LiquidPlane reduced={reduced} lite={lite} mouseRef={mouseRef} />
      </Canvas>
    </div>
  );
}
