import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import VenomExplore from './VenomExplore';

interface AboutPageProps {
  /** final stage: 0 = gallery still full, 1 = about page settled */
  progress: MotionValue<number>;
  reduced: boolean;
  isStandalone?: boolean;
}

interface Palette {
  inkLight: string;
  inkShade: string;
  bandLight: string;
  bandShade: string;
}

const PAPER: Palette = {
  inkLight: '#101010',
  inkShade: '#7a6a10',
  bandLight: '#efd400',
  bandShade: '#b9a100',
};

const KILN: Palette = {
  inkLight: '#ffe500',
  inkShade: '#6b5b00',
  bandLight: '#4a3c00',
  bandShade: '#241d00',
};

const RADIUS_SCALE = 7;
const TURNS = 2;
const SHADE = 0.8;
const TILT = 16;
const NEAR = 0.24;
const SPREAD = 2.4;
const RAD = Math.PI / 180;

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const inOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t: number) => t * t;
const travel = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

interface Letter {
  el: HTMLSpanElement;
  inner: HTMLElement | null;
  s: number;
  w: number;
  k: number;
  landed: boolean;
  space: boolean;
}

interface Band {
  el: HTMLElement;
  s: number;
  k: number;
}

interface TitleCylinderProps {
  title: string;
  q: MotionValue<number>;
  kind: 'unroll' | 'rollup';
  palette: Palette;
  reduced: boolean;
  interactive?: boolean;
  id?: string;
}

function TitleCylinder({
  title,
  q,
  kind,
  palette,
  reduced,
  interactive = false,
  id,
}: TitleCylinderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const drumRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const drag = useRef({ down: false, angle: 0, vel: 0, lastX: 0, lastT: 0 });
  const aim = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    const ring = ringRef.current;
    const drum = drumRef.current;
    if (!stage || !ring || !drum) return;

    const letters: Letter[] = letterRefs.current.map((el, i) => ({
      el: el as HTMLSpanElement,
      inner: (el?.firstElementChild as HTMLElement) || null,
      s: 0,
      w: 0,
      k: 0,
      landed: false,
      space: title[i] === ' ',
    }));
    let bands: Band[] = [];
    let R = 100;
    let C = 600;
    let size = 100;
    let near = 0;

    const measure = () => {
      ring.style.fontSize = '100px';
      const widths = letters.map((l) => l.el.getBoundingClientRect().width);
      let line = 0;
      widths.forEach((w) => {
        line += w;
      });
      const mobile = window.innerWidth < 720;
      const wide = window.innerWidth * (mobile ? 0.86 : 0.78);
      size = Math.min((wide / Math.max(1, line)) * 100, window.innerHeight * 0.14);
      const k = size / 100;
      const W = line * k;
      ring.style.fontSize = `${size}px`;
      let x = -W / 2;
      letters.forEach((l, i) => {
        l.w = widths[i] * k;
        l.s = x + l.w / 2;
        x += l.w;
        l.el.style.marginLeft = `${-l.w / 2}px`;
        l.el.style.marginTop = `${-size * 0.55}px`;
      });
      R = (Math.max(0.5, RADIUS_SCALE) * W) / (2 * Math.PI);
      C = 2 * Math.PI * R;
      letters.forEach((l) => {
        l.k = clamp((l.s + C / 2) / C);
      });
      const lens = Math.max(900, W * 1.5);
      stage.style.perspective = `${lens}px`;
      near = lens * NEAR * (mobile ? 1.7 : 1);

      bands.forEach((b) => b.el.remove());
      const count = Math.round(clamp(C / (size * 0.3), 24, 72));
      const bw = C / count;
      const bh = size * 1.12;
      bands = [];
      for (let j = 0; j < count; j++) {
        const el = document.createElement('i');
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.width = `${bw + 1}px`;
        el.style.height = `${bh}px`;
        el.style.marginLeft = `${-(bw + 1) / 2}px`;
        el.style.marginTop = `${-bh / 2 - size * 0.04}px`;
        el.style.borderRadius = '2px';
        el.style.transformStyle = 'preserve-3d';
        drum.appendChild(el);
        const s = -C / 2 + (j + 0.5) * bw;
        bands.push({ el, s, k: (s + C / 2) / C });
      }
    };

    const place = (s: number, u: number, spin: number, lift: number, dx: number, closer: number) => {
      const phi = s / R + spin * RAD;
      const r = R + lift;
      const x = lerp(r * Math.sin(phi) + dx, s, u);
      const z = lerp(r * Math.cos(phi) - R + closer, 0, u);
      const a = lerp(phi, 0, u);
      return { x, z, a };
    };

    const shade = (a: number) => {
      const facing = Math.cos(a);
      let v = (1 - facing) / 2 + 0.22 * Math.max(0, Math.sin(a));
      if (facing < 0) v += 0.35 * -facing;
      return Math.min(1, v * SHADE);
    };

    const render = (
      U: number,
      spin: number,
      tilt: number,
      y: number,
      scale: number,
      fade: number,
    ) => {
      const wave = (kk: number) => travel(clamp(U * (1 + SPREAD) - kk * SPREAD));
      const front = -C / 2 + (C * (U * (1 + SPREAD) - 0.5)) / SPREAD;
      const dx = Math.max(0, front + R * 1.15);
      spin += (-dx / R - (Math.PI / 2 - 1) * clamp(dx / R)) / RAD;
      const closer = near * (1 - inOut(U));

      for (const b of bands) {
        const u = wave(b.k);
        const p = place(b.s, u, spin, 0, dx, closer);
        b.el.style.transform = `translate3d(${p.x.toFixed(2)}px, 0, ${p.z.toFixed(2)}px) rotateY(${(p.a / RAD).toFixed(2)}deg)`;
        b.el.style.background = mixHex(palette.bandLight, palette.bandShade, Math.min(1, shade(p.a) * 1.1));
        const left = 1 - clamp(u * 10);
        b.el.style.opacity = (left * (0.86 - 0.4 * Math.max(0, -Math.cos(p.a)))).toFixed(3);
        b.el.style.visibility = left < 0.005 ? 'hidden' : 'visible';
      }

      for (const l of letters) {
        if (l.space) continue;
        const u = wave(l.k);
        const p = place(l.s, u, spin, size * 0.03, dx, closer);
        l.el.style.transform = `translate3d(${p.x.toFixed(2)}px, 0, ${p.z.toFixed(2)}px) rotateY(${(p.a / RAD).toFixed(2)}deg)`;
        l.el.style.color = mixHex(palette.inkLight, palette.inkShade, shade(p.a));
        l.el.style.opacity = (1 - 0.8 * clamp(-Math.cos(p.a) * 1.6)).toFixed(3);
        const flat = u >= 0.999;
        if (flat && !l.landed) {
          l.landed = true;
          if (!reduced && l.inner) {
            l.inner.animate(
              [
                { transform: 'scaleY(0.72) scaleX(1.16) translateY(5%)' },
                { transform: 'scaleY(1) scaleX(1) translateY(0%)' },
              ],
              { duration: 900, easing: 'cubic-bezier(0.22, 1.2, 0.36, 1)' },
            );
          }
        } else if (!flat && l.landed) {
          l.landed = false;
          l.inner?.getAnimations().forEach((a) => a.cancel());
          if (l.inner) l.inner.style.transform = '';
        }
      }

      const axis = closer - R * (1 - inOut(U));
      const move = `translate3d(0, ${y.toFixed(1)}px, 0) translateZ(${axis.toFixed(1)}px) rotateX(${(-tilt).toFixed(2)}deg) translateZ(${-axis.toFixed(1)}px) scale(${scale.toFixed(4)})`;
      ring.style.transform = move;
      drum.style.transform = move;
      ring.style.opacity = fade.toFixed(3);
      drum.style.opacity = fade.toFixed(3);
    };

    measure();
    render(kind === 'unroll' ? 0 : 1, 0, kind === 'unroll' ? TILT : 0, 0, 1, 1);

    let raf = 0;
    let alive = true;
    const tick = (time: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const d = drag.current;

      if (!d.down) {
        d.angle += d.vel;
        d.vel *= 0.94;
        if (Math.abs(d.vel) < 0.001) d.vel = 0;
      }

      const a = aim.current;
      a.x += (a.tx - a.x) * 0.06;
      a.y += (a.ty - a.y) * 0.06;

      const p = clamp(q.get());
      let U = 1;
      let spin = 0;
      let tilt = 0;
      let y = 0;
      let scale = 1;
      let fade = 1;
      const aimSpin = interactive ? a.x * 18 : 0;
      const aimTilt = interactive ? a.y * 6 : 0;

      if (kind === 'unroll') {
        if (reduced) {
          U = 1;
        } else {
          const rest = 1 - clamp(p / 0.12);
          const sway = Math.sin(time / 1000) * 6 * rest;
          const drift = Math.sin(time / 1400 + 1.2) * 2.4;
          spin = TURNS * 360 * (1 - inOut(clamp(p / 0.5))) + sway + drift + d.angle + aimSpin;
          U = clamp((p - 0.3) / 0.52);
          tilt = TILT * (1 - inOut(clamp((p - 0.12) / 0.18))) + aimTilt;
        }
      } else if (reduced) {
        const gone = clamp((p - 0.5) / 0.3);
        U = 1;
        fade = 1 - gone;
      } else {
        U = 1 - clamp((p - 0.1) / 0.55);
        spin = -TURNS * 360 * easeIn(clamp((p - 0.32) / 0.6)) + d.angle + aimSpin * 0.4;
        tilt = TILT * inOut(clamp((p - 0.56) / 0.16)) + aimTilt * 0.5;
        const away = easeIn(clamp((p - 0.7) / 0.28));
        y = -away * window.innerHeight * 0.45;
        scale = 1 - away * 0.5;
        fade = 1 - clamp((away - 0.4) / 0.6);
      }

      render(U, spin, tilt, y, scale, fade);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(() => measure()).catch(() => {});

    const onMove = (e: PointerEvent) => {
      aim.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      aim.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
      const d = drag.current;
      if (!d.down) return;
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      const ddx = e.clientX - d.lastX;
      d.angle += ddx * 0.22;
      d.vel = (ddx / dt) * 16;
      d.lastX = e.clientX;
      d.lastT = now;
    };
    if (interactive) window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (interactive) window.removeEventListener('pointermove', onMove);
    };
  }, [q, kind, palette, reduced, interactive, title]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const d = drag.current;
    d.down = true;
    d.lastX = e.clientX;
    d.lastT = performance.now();
    d.vel = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    drag.current.down = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute inset-0 flex touch-none select-none items-center justify-center ${
        interactive ? 'z-10 cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      }`}
      style={{ perspectiveOrigin: '50% 50%' }}
    >
      <div
        ref={drumRef}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-0 w-0"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      />
      <div
        ref={ringRef}
        id={id}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-0 w-0 font-display uppercase"
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {title.split('').map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className="pointer-events-none absolute left-0 top-0 whitespace-pre"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          >
            <span className="block" style={{ transformOrigin: '50% 90%' }}>
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AboutPage({ progress, reduced, isStandalone = false }: AboutPageProps) {
  const clipPath = useTransform(
    progress,
    [0.02, 0.28],
    ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'],
  );
  const pointerEvents = useTransform(progress, (v) => (v > 0.34 ? 'auto' : 'none'));

  const titleQ = useTransform(progress, [0.03, 0.58], [0, 1]);
  const kilnQ = useTransform(progress, [0.82, 1], [0, 1]);

  const introOpacity = useTransform(progress, [0.64, 0.7], [1, 0]);
  const summaryOpacity = useTransform(progress, [0.52, 0.57, 0.6, 0.64], [0, 1, 1, 0]);
  const hintOpacity = useTransform(progress, [0.05, 0.14], [1, 0]);

  const articleOpacity = useTransform(progress, [0.7, 0.75, 0.78, 0.84], [0, 1, 1, 0]);
  const kilnOpacity = useTransform(progress, [0.84, 0.9], [0, 1]);
  const kilnNoteOpacity = useTransform(progress, [0.94, 0.96, 0.98, 1], [0, 1, 1, 0]);
  const footerOpacity = useTransform(progress, [0.97, 1], [0, 1]);

  // venom pills only exist while the about page is on screen (keeps the WebGL
  // canvases off the earlier stages and avoids stealing the cursor there)
  const [venomOn, setVenomOn] = useState(false);

  useMotionValueEvent(progress, 'change', (v) => {
    // latch on: the vendored goo has no teardown, so never mount twice
    if (v > 0.24) setVenomOn(true);
  });

  const wrapperProps = isStandalone
    ? {
        id: 'about-page',
        className: 'relative min-h-screen w-full overflow-hidden bg-electric text-ink select-none',
      }
    : {
        id: 'about-page',
        style: { clipPath, pointerEvents },
        className: 'absolute inset-0 z-[80] overflow-hidden bg-electric text-ink select-none',
      };

  return (
    <motion.div {...wrapperProps}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between p-6 font-sans text-[10px] tracking-[0.4em] uppercase text-white mix-blend-difference md:p-10">
        <span className="font-semibold">ABOUT / SYSTEM:OFFMODE</span>
        <span className="text-right">
          FW26 ARCHIVE
          <span className="mt-1 block opacity-60">PARADIGM SHIFT</span>
        </span>
      </div>

      <div className="glass-layer pointer-events-none" aria-hidden="true" />

      <motion.section
        id="about-intro"
        style={{ opacity: introOpacity }}
        aria-label="About"
        className="absolute inset-0"
      >
        <TitleCylinder
          title="WEAR YOUR MOOD"
          q={titleQ}
          kind="unroll"
          palette={PAPER}
          reduced={reduced}
          interactive
          id="about-title"
        />
        <h2 className="sr-only">WEAR YOUR MOOD</h2>

        <div className="pointer-events-none absolute inset-x-0 top-[15%] z-20 flex justify-center px-8 text-center">
          <p className="max-w-[52ch] font-sans text-[10px] tracking-[0.4em] uppercase text-black/50">
            A STUDY IN SHADOW, LIGHT AND TYPE
          </p>
        </div>

        <motion.div
          style={{ opacity: summaryOpacity }}
          className="pointer-events-none absolute inset-x-0 top-[64%] z-20 flex flex-col items-center gap-3 px-8 text-center"
        >
          <p className="max-w-[54ch] font-sans text-[11px] font-medium leading-relaxed tracking-[0.24em] uppercase text-black/85">
            OFFMODE IS A MOOD SYSTEM {'\u2014'} GARMENTS CUT FOR THE HOURS BETWEEN
            DAY AND NIGHT.
          </p>
          <span className="font-mono text-[9px] tracking-[0.32em] uppercase text-black/45">
            STUDIO NOTES {'\u00b7'} FW26 {'\u00b7'} VOL. 01
          </span>
        </motion.div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center text-center"
        >
          <span className="rounded-full bg-black/5 px-4 py-1.5 font-sans text-[9px] tracking-[0.4em] uppercase text-black/40 backdrop-blur-sm">
            SCROLL TO UNROLL {'\u00b7'} DRAG TO SPIN
          </span>
        </motion.div>
      </motion.section>

      <motion.section
        id="about-article"
        style={{ opacity: articleOpacity }}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-24"
      >
        <div className="grid w-full max-w-[1000px] gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
          <div>
            <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-black/45">
              01 / THE SYSTEM
            </span>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.6rem)] uppercase leading-[0.9] -skew-x-6">
              BUILT FOR
              <br />
              THE IN-BETWEEN
            </h2>
            <p className="about-drop mt-6 max-w-[46ch] font-sans text-[12px] leading-[1.8] tracking-[0.06em] text-black/80">
              OFFMODE BEGINS IN THE HOURS BETWEEN DAY AND NIGHT, WHEN LIGHT FALLS
              AND SILHOUETTE BECOMES THE LOOK. EACH PIECE IS CUT AS AN ATTITUDE,
              NOT AN OUTFIT: LOOSE GEOMETRY, HEAVY FABRIC, ONE DECISIVE COLOUR.
            </p>
            <p className="mt-4 max-w-[46ch] font-sans text-[12px] leading-[1.8] tracking-[0.06em] text-black/65">
              FW26 COLLECTS THIRTEEN LOOKS ACROSS THREE MOODS. THEY ARE
              PHOTOGRAPHED IN DEPTH, LAYERED LIKE MEMORY, AND WEAR THE SAME RULE
              THROUGHOUT {'\u2014'} WEAR YOUR MOOD, NEVER THE MOMENT.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-8">
            <blockquote className="border-l border-black/25 pl-5 font-display text-[clamp(1.3rem,2.2vw,1.9rem)] uppercase leading-[1.05]">
              COLOUR IS THE
              <br />
              LOUDEST THING
              <br />
              YOU CAN WHISPER.
            </blockquote>
            <ul className="flex flex-col gap-2 font-mono text-[9px] tracking-[0.28em] uppercase text-black/55">
              <li className="flex justify-between border-t border-black/15 pt-2">
                <span>LOOKS</span>
                <span>13</span>
              </li>
              <li className="flex justify-between border-t border-black/15 pt-2">
                <span>MOODS</span>
                <span>03</span>
              </li>
              <li className="flex justify-between border-t border-black/15 pt-2">
                <span>SYSTEM</span>
                <span>01</span>
              </li>
              <li className="flex justify-between border-t border-black/15 pt-2">
                <span>SEASON</span>
                <span>FW26</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.section>

      <motion.div
        id="about-kiln"
        style={{ opacity: kilnOpacity }}
        className="absolute inset-0 z-30"
      >
        <div className="absolute inset-0 bg-[#0e0e0e]" />

        <TitleCylinder
          title="NEVER THE MOMENT"
          q={kilnQ}
          kind="rollup"
          palette={KILN}
          reduced={reduced}
          id="about-title-kiln"
        />

        <motion.div
          style={{ opacity: kilnNoteOpacity }}
          className="pointer-events-none absolute inset-x-0 top-[64%] z-20 flex flex-col items-center gap-3 px-8 text-center"
        >
          <p className="max-w-[48ch] font-sans text-[11px] leading-relaxed tracking-[0.24em] uppercase text-white/70">
            THE ARCHIVE CLOSES THE WAY A ROOM DOES {'\u2014'} SLOWLY, THEN ALL AT
            ONCE. THIRTEEN LOOKS, THREE MOODS, ONE SYSTEM.
          </p>
          <span className="font-mono text-[9px] tracking-[0.32em] uppercase text-white/35">
            END OF SEQUENCE {'\u00b7'} FW26
          </span>
        </motion.div>

        <motion.div
          id="about-footer"
          style={{ opacity: footerOpacity }}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-8 text-center"
        >
          <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-white/40">
            STUDIO NOTES
          </span>
          <h2 className="font-display text-[clamp(3.4rem,12vw,9rem)] uppercase leading-[0.82] -skew-x-6 text-electric">
            OFFMODE
          </h2>
          <p className="max-w-[42ch] font-sans text-[10px] leading-relaxed tracking-[0.26em] uppercase text-white/55">
            WEAR YOUR MOOD, NEVER THE MOMENT.
          </p>
          <span className="mt-4 font-mono text-[9px] tracking-[0.3em] uppercase text-white/30">
            FW26 SYSTEM // ALL RIGHTS RESERVED
          </span>
        </motion.div>
      </motion.div>

      {venomOn && (
        <>
          <VenomExplore side="left" />
          <VenomExplore side="right" />
          <VenomExplore side="top" />
          <VenomExplore side="bottom" />
        </>
      )}
    </motion.div>
  );
}
