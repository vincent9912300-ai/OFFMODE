export interface VenomMountOptions {
  canvas: HTMLCanvasElement;
  hit: HTMLButtonElement;
  /** pill label, defaults to EXPLORE */
  label?: string;
  /** distance from the right edge in CSS px (default 44) */
  padRight?: number;
  /** distance from the bottom edge in CSS px (default 44) */
  padBottom?: number;
}

/** Mounts the vendored venom-button goo button. One-shot: returns a no-op destroy. */
export declare function mountVenomButton(
  opts?: VenomMountOptions,
): (() => void) | undefined;
