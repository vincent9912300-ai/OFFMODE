import {
  resolvePalette,
  type Palette,
  type PaletteName,
  type ResolvedPalette,
} from "./presets";
import { fragmentShader, VERTEX_SHADER } from "./shaders";

/** Physical feel of the water. Every field is live-updatable via `setWave()`. */
export interface WaveOptions {
  /** Ambient swell height. `0` = glass-still water. */
  swell: number;
  /** Height of a ripple crest at birth. */
  amplitude: number;
  /** How fast a ring expands outward, in screen heights per second. */
  ringSpeed: number;
  /** Envelope fade rate. Higher = ripples die sooner. */
  decay: number;
  /** Ripples per unit distance inside a ring — higher = finer rings. */
  wavelength: number;
  /** Seconds a ripple stays in the height field before it is ignored. */
  life: number;
  /** How hard the surface bends the background. */
  refraction: number;
  /** Strength of the caustic shimmer. */
  caustics: number;
  /** Strength of the specular glint on the crests. */
  specular: number;
}

export const DEFAULT_WAVE: WaveOptions = {
  swell: 1,
  amplitude: 0.34,
  ringSpeed: 0.32,
  decay: 1.5,
  wavelength: 60,
  life: 5,
  refraction: 0.12,
  caustics: 0.3,
  specular: 0.85,
};

export type UnsupportedReason = "reduced-motion" | "no-webgl" | "shader-error";

/**
 * Coordinate space for `drop()`. All three have their origin at the top-left
 * and y pointing down, like the DOM.
 *
 * - `client` — viewport coordinates, i.e. `event.clientX/clientY` (default)
 * - `canvas` — CSS pixels relative to the canvas
 * - `uv` — fractions of the canvas, `0..1`
 */
export type CoordinateSpace = "client" | "canvas" | "uv";

export interface LiquidRippleOptions {
  /** Built-in palette name or your own colors. Default `"deep"`. */
  palette?: PaletteName | Palette;
  /** Overrides for the water's feel. See {@link DEFAULT_WAVE}. */
  wave?: Partial<WaveOptions>;
  /** Concurrent ripples. Baked into the shader, so it cannot change later. Default `24`. */
  maxRipples?: number;
  /**
   * Where pointer movement spawns ripples: `"window"` (anywhere on the page,
   * the default for `true`), `"canvas"` (only over the canvas), or `false`.
   */
  interactive?: boolean | "window" | "canvas";
  /** Milliseconds between self-spawned drops, so the water is never still. `0` disables. Default `2300`. */
  ambient?: number;
  /** Minimum milliseconds between pointer-spawned ripples. Default `110`. */
  pointerThrottle?: number;
  /** Upper bound on `devicePixelRatio`. Default `1.5` — this is a background. */
  dprCap?: number;
  /** Time multiplier. `0.5` = half speed. Default `1`. */
  speed?: number;
  /** Canvas opacity, `0..1`. Below `1` the canvas is composited over what's behind it. Default `1`. */
  opacity?: number;
  /** Render nothing when the user asks for less motion. Default `true`. Leave it on. */
  respectReducedMotion?: boolean;
  /** Called instead of rendering when the effect can't run. Use it to reveal a fallback. */
  onUnsupported?: (reason: UnsupportedReason) => void;
  /**
   * FORK ONLY (offmode): an image drawn behind the water — sampled through
   * the refracted UV so type and color bend under waves. When `null`, the
   * palette gradient (upstream behavior) is used instead.
   */
  backdrop?: TexImageSource | null;
}

export interface LiquidRipple {
  readonly canvas: HTMLCanvasElement;
  /** Spawn a ripple. Defaults to viewport (`clientX`/`clientY`) coordinates. */
  drop(x: number, y: number, space?: CoordinateSpace): void;
  /** Swap colors without recompiling. */
  setPalette(palette: PaletteName | Palette): void;
  /** Patch the water's feel. Unspecified fields keep their current value. */
  setWave(wave: Partial<WaveOptions>): void;
  /** Change the time multiplier. */
  setSpeed(speed: number): void;
  /** Stop the render loop (and ambient drops). Cheap — use it offscreen. */
  pause(): void;
  /** Restart after `pause()`. Time resumes where it left off. */
  resume(): void;
  /** Remove every listener, free the GL objects, drop the context. */
  destroy(): void;
  /** FORK ONLY: swap the refracted backdrop texture (e.g. after a redraw). */
  setBackdrop(source: TexImageSource | null): void;
}

/** True when this browser can render the effect and the user hasn't opted out of motion. */
export function isSupported(
  options: { respectReducedMotion?: boolean } = {},
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (options.respectReducedMotion !== false && prefersReducedMotion()) return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(
      probe.getContext("webgl") ?? probe.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * Start the water on a canvas.
 *
 * Returns `null` — after calling `onUnsupported` — when the effect must not or
 * cannot run (server-side, reduced motion, no WebGL, shader failure). Treat
 * `null` as "leave the CSS fallback visible"; it is not an error.
 *
 * The canvas is sized from its own CSS box, so give it a size (e.g.
 * `position:absolute; inset:0`) and let this own its `width`/`height`.
 */
export function createLiquidRipple(
  canvas: HTMLCanvasElement,
  options: LiquidRippleOptions = {},
): LiquidRipple | null {
  const {
    palette = "deep",
    wave,
    maxRipples = 24,
    interactive = true,
    ambient = 2300,
    pointerThrottle = 110,
    dprCap = 1.5,
    speed = 1,
    opacity = 1,
    respectReducedMotion = true,
    onUnsupported,
    backdrop = null,
  } = options;

  if (typeof window === "undefined") return null;
  if (respectReducedMotion && prefersReducedMotion()) {
    onUnsupported?.("reduced-motion");
    return null;
  }

  const gl = (canvas.getContext("webgl", {
    antialias: false,
    alpha: opacity < 1,
    premultipliedAlpha: false,
  }) ?? null) as WebGLRenderingContext | null;
  if (!gl) {
    onUnsupported?.("no-webgl");
    return null;
  }

  const slots = Math.max(1, Math.floor(maxRipples));
  // Three floats per slot: x, y, spawn time. Negative time = empty slot.
  const ripples = new Float32Array(slots * 3).fill(-1);
  let cursor = 0;

  let colors: ResolvedPalette = resolvePalette(palette);
  const feel: WaveOptions = { ...DEFAULT_WAVE, ...wave };
  let rate = speed;
  const alpha = clamp(opacity, 0, 1);

  type Locations = Record<string, WebGLUniformLocation | null>;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let u: Locations | null = null;
  // Backing store size the canvas was last configured for; -1 forces a resync.
  let sized = { w: -1, h: -1 };

  // ── FORK: refracted backdrop texture ─────────────────────────────────
  let backdropTex: WebGLTexture | null = null;
  let backdropSrc: TexImageSource | null = backdrop;
  let hasBackdrop = false;

  function uploadBackdrop(): void {
    if (!backdropSrc) {
      hasBackdrop = false;
      if (u) gl!.uniform1f(u.hasBackdrop, 0);
      return;
    }
    if (!backdropTex) backdropTex = gl!.createTexture();
    if (!backdropTex) return;
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, backdropTex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texImage2D(
      gl!.TEXTURE_2D,
      0,
      gl!.RGBA,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      backdropSrc as TexImageSource,
    );
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    hasBackdrop = true;
    if (u) {
      gl!.uniform1i(u.backdrop, 0);
      gl!.uniform1f(u.hasBackdrop, 1);
    }
  }

  /** Compile, link and prime everything. Re-runnable after context loss. */
  function build(): boolean {
    const vs = compile(gl!, gl!.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl!, gl!.FRAGMENT_SHADER, fragmentShader(slots));
    if (!vs || !fs) return false;

    const prog = gl!.createProgram();
    if (!prog) return false;
    gl!.attachShader(prog, vs);
    gl!.attachShader(prog, fs);
    gl!.linkProgram(prog);
    gl!.deleteShader(vs);
    gl!.deleteShader(fs);
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      gl!.deleteProgram(prog);
      return false;
    }
    gl!.useProgram(prog);
    program = prog;

    // One oversized triangle covers the viewport — cheaper than two.
    buffer = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(
      gl!.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl!.STATIC_DRAW,
    );
    const aPos = gl!.getAttribLocation(prog, "a_pos");
    gl!.enableVertexAttribArray(aPos);
    gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 0, 0);

    const loc: Locations = {};
    for (const name of UNIFORMS) {
      loc[name] = gl!.getUniformLocation(prog, `u_${name}`);
    }
    u = loc;
    if (alpha < 1) {
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
    }
    pushPalette();
    pushWave();
    gl!.uniform1f(loc.opacity, alpha);
    gl!.uniform1i(loc.backdrop, 0);
    gl!.uniform1f(loc.hasBackdrop, 0);
    // Re-upload after a context loss so the texture survives.
    uploadBackdrop();
    sized = { w: -1, h: -1 };
    return true;
  }

  function pushPalette(): void {
    if (!u) return;
    gl!.uniform3fv(u.top, colors.top);
    gl!.uniform3fv(u.bottom, colors.bottom);
    gl!.uniform3fv(u.glint, colors.glint);
  }

  function pushWave(): void {
    if (!u) return;
    gl!.uniform1f(u.swell, feel.swell);
    gl!.uniform1f(u.amplitude, feel.amplitude);
    gl!.uniform1f(u.ringSpeed, feel.ringSpeed);
    gl!.uniform1f(u.decay, feel.decay);
    gl!.uniform1f(u.wavelength, feel.wavelength);
    gl!.uniform1f(u.life, Math.max(0.05, feel.life));
    gl!.uniform1f(u.refraction, feel.refraction);
    gl!.uniform1f(u.caustics, feel.caustics);
    gl!.uniform1f(u.specular, feel.specular);
  }

  if (!build()) {
    onUnsupported?.("shader-error");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  // ── sizing ────────────────────────────────────────────────────────────
  function syncSize(): boolean {
    const dpr = Math.min(Math.max(0.25, dprCap), window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w === sized.w && h === sized.h) return canvas.clientWidth > 0;
    sized = { w, h };
    canvas.width = w;
    canvas.height = h;
    gl!.viewport(0, 0, w, h);
    return canvas.clientWidth > 0;
  }

  let observer: ResizeObserver | null = null;
  const onWindowResize = () => {
    sized = { w: -1, h: -1 };
  };
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(onWindowResize);
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  // ── clock ─────────────────────────────────────────────────────────────
  // Accumulated (not wall) time, so `speed` changes and `pause()` never make
  // live ripples jump: their spawn stamps live on this same clock.
  let clock = 0;
  let last = 0;
  let raf = 0;
  let running = false;

  function aspect(): number {
    return canvas.clientWidth / Math.max(1, canvas.clientHeight);
  }

  function spawn(nx: number, ny: number): void {
    ripples[cursor * 3] = nx * aspect();
    ripples[cursor * 3 + 1] = 1 - ny;
    ripples[cursor * 3 + 2] = clock;
    cursor = (cursor + 1) % slots;
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    // Clamp so a throttled/backgrounded tab doesn't fast-forward the water.
    clock += Math.min(0.1, Math.max(0, (now - last) / 1000)) * rate;
    last = now;
    if (!u || document.hidden) return;
    if (!syncSize()) return;
    gl!.uniform2f(u.res, canvas.width, canvas.height);
    gl!.uniform1f(u.time, clock);
    gl!.uniform3fv(u.ripples, ripples);
    if (hasBackdrop) {
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, backdropTex);
    }
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function start(): void {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  // ── input ─────────────────────────────────────────────────────────────
  const target: EventTarget | null =
    interactive === false ? null : interactive === "canvas" ? canvas : window;

  let lastMove = 0;
  const onMove = (ev: Event) => {
    const now = performance.now();
    if (now - lastMove < pointerThrottle) return;
    lastMove = now;
    dropClient(ev as PointerEvent);
  };
  const onDown = (ev: Event) => dropClient(ev as PointerEvent);
  function dropClient(ev: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    spawn(
      (ev.clientX - rect.left) / rect.width,
      (ev.clientY - rect.top) / rect.height,
    );
  }
  target?.addEventListener("pointermove", onMove, { passive: true });
  target?.addEventListener("pointerdown", onDown, { passive: true });

  const ambientTimer =
    ambient > 0
      ? window.setInterval(() => {
          if (document.hidden || !running) return;
          spawn(Math.random(), Math.random());
        }, ambient)
      : 0;

  // ── context loss ──────────────────────────────────────────────────────
  const onLost = (ev: Event) => {
    ev.preventDefault(); // required, or the context is never restored
    stop();
    u = null;
    program = null;
    buffer = null;
  };
  const onRestored = () => {
    if (build()) start();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  start();

  return {
    canvas,
    drop(x, y, space = "client") {
      if (space === "uv") return spawn(x, y);
      if (space === "canvas") {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;
        return spawn(x / w, y / h);
      }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      spawn((x - rect.left) / rect.width, (y - rect.top) / rect.height);
    },
    setPalette(next) {
      colors = resolvePalette(next);
      pushPalette();
    },
    setWave(next) {
      Object.assign(feel, next);
      pushWave();
    },
    setSpeed(next) {
      rate = next;
    },
    setBackdrop(source) {
      backdropSrc = source;
      uploadBackdrop();
    },
    pause: stop,
    resume: start,
    destroy() {
      stop();
      if (ambientTimer) window.clearInterval(ambientTimer);
      target?.removeEventListener("pointermove", onMove);
      target?.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      observer?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      if (backdropTex) gl.deleteTexture(backdropTex);
      backdropTex = null;
      hasBackdrop = false;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      u = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

const UNIFORMS = [
  "res",
  "time",
  "top",
  "bottom",
  "glint",
  "opacity",
  "swell",
  "amplitude",
  "ringSpeed",
  "decay",
  "wavelength",
  "life",
  "refraction",
  "caustics",
  "specular",
  "ripples",
  "backdrop",
  "hasBackdrop",
] as const;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}
