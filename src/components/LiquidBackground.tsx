import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MousePos } from '../hooks/useMousePosition';
import { TRAIL_MAX, type TrailPool } from '../hooks/usePointerTrail';
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
uniform float uLite;   // 1 = mobile / simplified pass
uniform vec2  uMouse;  // smoothed normalized pointer, -1..1
uniform vec2  uRes;    // css pixel size
uniform vec4  uTrail[16]; // xy = pos (-1..1), z = age (s), w = strength

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float segDist(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  return length(pa - ba * t);
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;

  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  p += uMouse * vec2(0.03, 0.02);

  float t = uTime;
  float aa = 1.5 / max(uRes.y, 720.0);

  // electric yellow base (#FFE500)
  vec3 col = vec3(1.0, 0.898, 0.0);

  /* ---- small glossy silver droplets, swept aside by the flow ---- */
  if (uLite < 0.5) {
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float sx = hash21(vec2(fj * 12.9898, 4.1414));
      float sy = hash21(vec2(fj * 3.7, 8.27));
      float sf = hash21(vec2(fj * 7.9, 2.13));

      vec2 cp = vec2(
        (sx - 0.5) * aspect * 0.9 + sin(t * (0.25 + 0.14 * sy) + fj * 2.4) * 0.05,
        sy * 0.9 - 0.45 + cos(t * 0.36 + fj * 3.1) * 0.04
      );

      // surface-tension push from every live trail point
      vec2 push = vec2(0.0);
      for (int k = 0; k < 16; k++) {
        vec4 tp = uTrail[k];
        if (tp.w <= 0.001) continue;
        vec2 tc = tp.xy * vec2(aspect, 1.0) * 0.5;
        vec2 dv = cp - tc;
        push += normalize(dv + vec2(1e-4)) * exp(-dot(dv, dv) * 42.0) * exp(-tp.z * 0.7);
      }
      cp += push * 0.05;

      float r = 0.006 + 0.013 * sf;
      vec2 dp = (p - cp) / vec2(1.0, 1.25);
      float dd = length(dp);
      float dm = 1.0 - smoothstep(r, r + aa, dd);

      float body = clamp(1.0 - dd / r, 0.0, 1.0);
      vec3 dc = mix(vec3(0.93, 0.94, 0.96), vec3(0.45, 0.47, 0.52), pow(body, 0.65) * 0.8);
      col = mix(col, dc, dm);

      vec2 hp = (p - (cp - vec2(r * 0.35, r * 0.35))) / vec2(1.0, 1.25);
      float hl = 1.0 - smoothstep(0.0, r * 0.45, length(hp));
      col += dm * hl * 0.95;
    }
  }

  /* ---- viscous pointer trail: butter tension along the drag path ----
     consecutive smoothed points form a continuous smear in drag order;
     each segment widens and melts as it ages, with a soft cast shadow
     underneath and a glossy strip on top for depth */
  float bodyF = 0.0;
  float gloss = 0.0;
  float shade = 0.0;

  for (int i = 0; i < 15; i++) {
    vec4 A = uTrail[i];
    vec4 B = uTrail[i + 1];
    if (A.w <= 0.001 || B.w <= 0.001) continue;

    vec2 a = A.xy * vec2(aspect, 1.0) * 0.5;
    vec2 b = B.xy * vec2(aspect, 1.0) * 0.5;
    float age = max(A.z, B.z);
    float str = min(A.w, B.w);
    float fade = str * (1.0 - smoothstep(2.2, 3.5, age));

    float ti;
    float d = segDist(p, a, b, ti);
    float w = 0.042 + age * 0.03;
    float fall = exp(-(d * d) / (w * w));

    // slow undulation along the drag axis — flowing, not a static line
    vec2 dir = normalize(b - a + vec2(1e-5));
    float along = dot(p - a, dir);
    fall *= 0.84 + 0.16 * sin(along * 8.0 - t * 0.8 + float(i) * 1.9);
    bodyF = max(bodyF, fall * fade);

    float tg;
    float dG = segDist(p - vec2(0.010, 0.016), a, b, tg);
    gloss = max(gloss, exp(-(dG * dG) / (w * w * 0.3)) * fade);

    float ts;
    float dS = segDist(p - vec2(-0.012, -0.020), a, b, ts);
    shade = max(shade, exp(-(dS * dS) / (w * w * 1.7)) * fade);
  }

  // depth stack: cast shadow → smear body → specular strip → tension rim
  col = mix(col, col * vec3(0.70, 0.64, 0.42), shade * 0.55);
  col = mix(col, vec3(1.0, 0.965, 0.82), bodyF * 0.4);
  col += gloss * 0.28;
  float rim = smoothstep(0.12, 0.45, bodyF) * (1.0 - smoothstep(0.45, 0.85, bodyF));
  col -= rim * 0.05;

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
  trail: React.RefObject<TrailPool>;
}

function LiquidPlane({ reduced, lite, mouseRef, trail }: LiquidPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetMouse = useRef(new THREE.Vector2(0, 0));
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLite: { value: lite ? 1 : 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTrail: {
        value: Array.from(
          { length: TRAIL_MAX },
          () => new THREE.Vector4(0, 0, 999, 0),
        ),
      },
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

    targetMouse.current.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.uMouse.value.lerp(targetMouse.current, reduced ? 0 : 0.035);

    // mirror the shared CPU trail into the shader, in drag order
    const arr = uniforms.uTrail.value as THREE.Vector4[];
    const pts = trail.current.points;
    for (let i = 0; i < TRAIL_MAX; i++) {
      const pt = pts[i];
      if (pt) arr[i].set(pt.x, pt.y, pt.age, pt.strength);
      else arr[i].set(0, 0, 999, 0);
    }
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
  trail: React.RefObject<TrailPool>;
}

export default function LiquidBackground({
  ready,
  reduced,
  lite,
  mouseRef,
  trail,
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
        <LiquidPlane reduced={reduced} lite={lite} mouseRef={mouseRef} trail={trail} />
      </Canvas>
    </div>
  );
}
