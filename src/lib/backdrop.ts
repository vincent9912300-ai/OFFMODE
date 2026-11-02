/**
 * Offscreen backdrop for the water shader.
 *
 * The water can only bend what it samples, so the hero composition — bright
 * yellow plane + massive black OFFMODE — is rasterized here into a canvas
 * texture. The forked liquid-ripple shader samples it through the refracted
 * UV, which is what makes the type visibly bend under waves.
 *
 * Layout mirrors `.wordmark` in animations.css:
 *   Anton 400 · clamp(3.6rem, 21.5vw, 23rem) · tracking -0.012em · #050505
 *   skewX(-8deg) scaleY(1.18), centered.
 */

const YELLOW = "#ffe500";
const INK = "#050505";

export interface Backdrop {
  /** Hidden canvas that gets uploaded as the GL texture. */
  readonly canvas: HTMLCanvasElement;
  /** Rasterize the composition at the given viewport size (CSS px × dpr). */
  draw(cssWidth: number, cssHeight: number, dpr: number): void;
}

export function createBackdrop(): Backdrop {
  const canvas = document.createElement("canvas");
  const ctxOrNull = canvas.getContext("2d", { alpha: false });
  if (!ctxOrNull) {
    return {
      canvas,
      draw() {
        canvas.width = 1;
        canvas.height = 1;
      },
    };
  }
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  function draw(cssWidth: number, cssHeight: number, dpr: number): void {
    const w = Math.max(1, Math.round(cssWidth));
    const h = Math.max(1, Math.round(cssHeight));
    const scale = Math.min(Math.max(0.5, dpr), 2);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    // Work in CSS pixels; the backing store is already scaled.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, 0, w, h);

    const fontSize = Math.min(Math.max(w * 0.215, 3.6 * 16), 23 * 16);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    // skewX(-8deg) scaleY(1.18) — rightmost CSS transform applies first
    const skew = Math.tan((-8 * Math.PI) / 180) * 1.18;
    ctx.transform(1, 0, skew, 1.18, 0, 0);
    ctx.font = `400 ${fontSize}px Anton, "Archivo Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const track = -0.012 * fontSize;
    const nativeTracking = "letterSpacing" in ctx;
    if (nativeTracking) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${track}px`;
    }

    // the stroke echo sits behind the faces (the CSS `.wordmark-echo` offset)
    ctx.save();
    ctx.translate(-0.02 * fontSize, -0.035 * fontSize);
    ctx.strokeStyle = "rgba(5, 5, 5, 0.3)";
    ctx.lineWidth = 0.014 * fontSize;
    if (nativeTracking) {
      ctx.strokeText("OFFMODE", 0, 0);
    } else {
      drawTracked(ctx, "OFFMODE", track, true);
    }
    ctx.restore();

    ctx.fillStyle = INK;
    if (nativeTracking) {
      ctx.fillText("OFFMODE", 0, 0);
    } else {
      drawTracked(ctx, "OFFMODE", track, false);
    }
    ctx.restore();
  }

  return { canvas, draw };
}

/**
 * Letter-spaced text for canvases without `ctx.letterSpacing` (older
 * Safari). Per-character placement with the same tracking as the CSS.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  track: number,
  stroke: boolean,
): void {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = -total / 2;
  chars.forEach((ch, i) => {
    if (stroke) ctx.strokeText(ch, x, 0);
    else ctx.fillText(ch, x, 0);
    x += widths[i] + track;
  });
  ctx.textAlign = prevAlign;
}
