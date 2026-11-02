import { toRgbFloat, type Color } from "./color";

/**
 * A water palette. `top`/`bottom` are the vertical gradient of the pool;
 * `glint` tints the caustic shimmer and the specular highlight, so it should
 * be the lightest of the three.
 */
export interface Palette {
  top: Color;
  bottom: Color;
  glint: Color;
}

/** Built-in palettes. Pass the name, or your own `Palette` object. */
export const PALETTES = {
  /** Bright tropical shallows — the one on axistify.com/demo. */
  lagoon: { top: "#8cded1", bottom: "#0a8073", glint: "#f2fffc" },
  /** Deep teal at night. Reads well behind light text. */
  deep: { top: "#043238", bottom: "#01141c", glint: "#8cf2e6" },
  /** Chlorinated swimming pool, midday. */
  pool: { top: "#7fe3f0", bottom: "#0e7490", glint: "#ffffff" },
  /** Navy ocean — cold, corporate. */
  ink: { top: "#0b2545", bottom: "#01060f", glint: "#7fb2ff" },
  /** Violet dusk. */
  dusk: { top: "#2a1b4a", bottom: "#0b0616", glint: "#c9a6ff" },
  /** Warm copper — sunset on the water. */
  ember: { top: "#7a3418", bottom: "#1d0803", glint: "#ffc48c" },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export interface ResolvedPalette {
  top: [number, number, number];
  bottom: [number, number, number];
  glint: [number, number, number];
}

export function resolvePalette(
  palette: PaletteName | Palette = "deep",
): ResolvedPalette {
  const p: Palette =
    typeof palette === "string"
      ? (PALETTES[palette] ?? PALETTES.deep)
      : palette;
  return {
    top: toRgbFloat(p.top),
    bottom: toRgbFloat(p.bottom),
    glint: toRgbFloat(p.glint),
  };
}
