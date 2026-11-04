/** A region inside a pane's scroll content: where it starts, and how far the pane can scroll in it. */
export interface PaneRange {
  top: number;
  max: number;
}

/**
 * Maps a scroll position from one region onto the other: the part above `top` (the headers) is
 * spread linearly, the region itself proportionally. A region that cannot scroll leaves the other
 * at its start rather than running it backwards.
 */
export function mapScroll(x: number, from: PaneRange, to: PaneRange): number {
  if (x <= from.top) return from.top > 0 ? (Math.max(0, x) / from.top) * to.top : 0;
  // A region with no room of its own cannot say where it is; hold the other at its start.
  if (from.max <= 0) return to.top;

  const progress = Math.min(1, Math.max(0, (x - from.top) / from.max));
  return to.top + progress * Math.max(0, to.max);
}
