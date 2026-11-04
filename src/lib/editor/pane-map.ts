export interface PaneRange {
  top: number;
  max: number;
}

export function mapScroll(x: number, from: PaneRange, to: PaneRange): number {
  if (x <= from.top) return from.top > 0 ? (Math.max(0, x) / from.top) * to.top : 0;
  // A region with no room of its own cannot say where it is; hold the other at its start.
  if (from.max <= 0) return to.top;

  const progress = Math.min(1, Math.max(0, (x - from.top) / from.max));
  return to.top + progress * Math.max(0, to.max);
}
