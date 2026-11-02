/**
 * liquid-ripple — vendored fork (offmode).
 *
 * Copied from `liquid-ripple@0.1.1` (MIT) and extended with one feature the
 * upstream package does not have: a `backdrop` texture that gets sampled
 * through the refraction, so a full-viewport composition (yellow plane +
 * OFFMODE wordmark, drawn to an offscreen canvas) visibly bends under the
 * water instead of a flat gradient.
 *
 * Only `core.ts` and `shaders.ts` were modified; `color.ts` and
 * `presets.ts` are verbatim copies.
 */

export { createLiquidRipple, isSupported, DEFAULT_WAVE } from "./core";
export type {
  CoordinateSpace,
  LiquidRipple,
  LiquidRippleOptions,
  UnsupportedReason,
  WaveOptions,
} from "./core";

export { PALETTES, resolvePalette } from "./presets";
export type { Palette, PaletteName, ResolvedPalette } from "./presets";

export { toRgbFloat } from "./color";
export type { Color } from "./color";

// Exported for the curious and for anyone who wants to fork the look.
export { VERTEX_SHADER, fragmentShader } from "./shaders";
