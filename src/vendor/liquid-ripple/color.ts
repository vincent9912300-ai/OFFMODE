/** Color input: a CSS hex string (`#0d9488`, `#0d9`) or an RGB triplet. */
export type Color = string | readonly [number, number, number];

/**
 * Normalize a color to the `[0..1, 0..1, 0..1]` triplet the shader wants.
 *
 * RGB triplets are treated as 0–255 unless every channel is <= 1, in which
 * case they are assumed to already be normalized — so both `[13, 148, 136]`
 * and `[0.05, 0.58, 0.53]` do the right thing.
 */
export function toRgbFloat(color: Color): [number, number, number] {
  if (typeof color !== "string") {
    const [r, g, b] = color;
    const normalized = r <= 1 && g <= 1 && b <= 1;
    const scale = normalized ? 1 : 1 / 255;
    return [clamp01(r * scale), clamp01(g * scale), clamp01(b * scale)];
  }

  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error(`liquid-ripple: could not parse color "${color}"`);
  }

  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
