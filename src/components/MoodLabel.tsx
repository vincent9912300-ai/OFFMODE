import { useEffect, useRef } from 'react';
import { useMotionValue } from 'framer-motion';

interface MoodLabelProps {
  /** 0 → 1 across the final scroll stage, so the label can fade with the page */
  progress: number;
  /** which word this label carries */
  word: string;
  /** label stays alive only while the page is within this reveal window */
  revealWindow: [number, number];
}

/** one word rendered through the vendored venom-button label path
 *  (the same `setLabelText` → labelCanvas → labelTex mask pipeline),
 *  so the letters carry the same below/above-light chrome and stamped edge
 *  the EXPLORE pill used — not a new font treatment. */
export default function MoodLabel({ progress, word, revealWindow }: MoodLabelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opacity = useMotionValue(0);

  // the label is drawn once, then replayed each time the page settles again
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // match the vendored label path closely enough that the same word
    // produces the same glyph texture: white fill, centred, alphabetic baseline,
    // on the same 1024×256 label canvas the button uses.
    const FONT_PX = 120;
    ctx.clearRect(0, 0, 1024, 256);
    ctx.font = `700 ${FONT_PX}px "Anton", "Archivo Black", "Arial Black", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(word);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    // vertical centre the glyphs the way the vendored code does (cap-height-ish)
    const y =
      256 / 2 +
      (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(word, 1024 / 2, y);

    // keep the mask centred in the label frame the way the button does
    const labelW = Math.max(inkW + 64, 256);
    const labelH = Math.max(inkH + 24, 64);
    canvas.width = Math.round(labelW);
    canvas.height = Math.round(labelH);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `700 ${FONT_PX * (canvas.width / 1024)}px "Anton", "Archivo Black", "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      word,
      canvas.width / 2,
      canvas.height / 2 +
        ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) *
          (canvas.width / 1024)) /
          2,
    );
  }, [word]);

  // fade the label in as the page arrives and settle, then back out at the end
  useEffect(() => {
    const start = revealWindow[0];
    const inEnd = start + 0.18;
    const outStart = revealWindow[1] - 0.04;
    const end = revealWindow[1];

    opacity.set(0);
    let raf = 0;
    const tick = () => {
      const inst = Math.max(0, Math.min(1, (progress - start) / (inEnd - start)));
      if (progress <= inEnd) {
        opacity.set(clamp01(inst));
      } else if (progress < outStart) {
        opacity.set(1);
      } else {
        const out = clamp01((end - progress) / (end - outStart));
        opacity.set(clamp01(out));
      }
      if (progress <= end) raf = requestAnimationFrame(tick);
      else cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block select-none"
      aria-hidden="true"
      title={word}
      style={{ opacity: opacity as unknown as number }}
    />
  );
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
