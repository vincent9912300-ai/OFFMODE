export interface VenomMountOptions {
  canvas: HTMLCanvasElement;
  hit: HTMLButtonElement;
  /** pill label, defaults to EXPLORE */
  label?: string;
  /** distance from the right edge in CSS px (default 44) */
  padRight?: number;
  /** distance from the bottom edge in CSS px (default 44) */
  padBottom?: number;
  /** distance from the left edge in CSS px (overrides padRight) */
  padLeft?: number;
  /** distance from the top edge in CSS px (overrides padBottom) */
  padTop?: number;
  /** pin the goo to a display edge: slab hidden, all goo comes out of the border */
  side?: 'left' | 'right' | 'top' | 'bottom';
}

/** Mounts the vendored venom-button goo button. One-shot: returns a no-op destroy. */
export declare function mountVenomButton(
  opts?: VenomMountOptions,
): (() => void) | undefined;
