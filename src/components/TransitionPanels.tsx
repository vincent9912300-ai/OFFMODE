import type { CSSProperties } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';

interface TransitionPanelsProps {
  /** panels stage progress: 0 = page two settled, 1 = fully attached */
  s2: MotionValue<number>;
  reduced: boolean;
}

interface PanelSpec {
  color: string;
  from: 'left' | 'right' | 'top' | 'bottom';
  width: string;
  height: string;
  offset: CSSProperties;
  inStart: number;
  inEnd: number;
}

// Corner collage, exactly as briefed: black 60×30 from the top-left, yellow
// 40×60 dropping in from the top-right, black 40×40 from the bottom-right,
// yellow 60×70 rising from the bottom-left. Different sizes, different
// directions, all sharpening as they attach; the look images then fade in
// over them — no circle wipe involved.
const panels: PanelSpec[] = [
  {
    color: '#111111',
    from: 'left',
    width: '60vw',
    height: '30vh',
    offset: { left: 0, top: 0 },
    inStart: 0.05,
    inEnd: 0.3,
  },
  {
    color: '#ffe500',
    from: 'top',
    width: '40vw',
    height: '40vh',
    offset: { right: 0, top: 0 },
    inStart: 0.09,
    inEnd: 0.36,
  },
  {
    color: '#0b0b0b',
    from: 'right',
    width: '40vw',
    height: '60vh',
    offset: { right: 0, bottom: 0 },
    inStart: 0.13,
    inEnd: 0.42,
  },
  {
    color: '#ffe500',
    from: 'bottom',
    width: '60vw',
    height: '70vh',
    offset: { left: 0, bottom: 0 },
    inStart: 0.17,
    inEnd: 0.48,
  },
];

function Panel({
  spec,
  s2,
  reduced,
  z,
}: {
  spec: PanelSpec;
  s2: MotionValue<number>;
  reduced: boolean;
  z: number;
}) {
  const horizontal = spec.from === 'left' || spec.from === 'right';
  const dir = spec.from === 'left' || spec.from === 'top' ? -1 : 1;
  const shift = useTransform(s2, [spec.inStart, spec.inEnd], [`${dir * 130}%`, '0%']);
  // sharpen as they slide in, then go fully soft once every sheet is
  // connected — the collage melts into a blurred backdrop for the cylinder
  const blur = useTransform(
    s2,
    [spec.inStart, spec.inEnd, spec.inEnd + 0.1, 0.9],
    reduced
      ? ['blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(0px)']
      : ['blur(20px)', 'blur(0px)', 'blur(0px)', 'blur(64px)'],
  );

  return (
    <motion.div
      aria-hidden="true"
      style={{
        x: horizontal ? shift : 0,
        y: horizontal ? 0 : shift,
        filter: blur,
        zIndex: z,
        width: spec.width,
        height: spec.height,
        backgroundColor: spec.color,
        ...spec.offset,
      }}
      className="pointer-events-none absolute"
    />
  );
}

export default function TransitionPanels({ s2, reduced }: TransitionPanelsProps) {
  return (
    <motion.div
      id="transition-panels"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[72] overflow-hidden"
    >
      {panels.map((spec, i) => (
        <Panel key={spec.color + i} spec={spec} s2={s2} reduced={reduced} z={i + 1} />
      ))}
    </motion.div>
  );
}
