import type { ArticleAnalyticsRow, WebVital } from "./types";

export interface PageviewsSeries {
  ts: number[];
  pv7d: number[];
}

export interface WebVitalRatioSeries {
  ts: number[];
  lcp: (number | null)[];
  inp: (number | null)[];
  cls: (number | null)[];
  ttfb: (number | null)[];
}

export function goodRatio(v: WebVital): number | null {
  const total = v.good + v.needsImprovement + v.bad;
  if (total === 0) return null;
  return v.good / total;
}

export function toPageviewsSeries(rows: ArticleAnalyticsRow[]): PageviewsSeries {
  const ts: number[] = [];
  const pv7d: number[] = [];
  for (const r of rows) {
    ts.push(Math.floor(r.capturedAt.getTime() / 1000));
    pv7d.push(r.pageviews7d);
  }
  return { ts, pv7d };
}

export function toWebVitalRatioSeries(rows: ArticleAnalyticsRow[]): WebVitalRatioSeries {
  const ts: number[] = [];
  const lcp: (number | null)[] = [];
  const inp: (number | null)[] = [];
  const cls: (number | null)[] = [];
  const ttfb: (number | null)[] = [];
  for (const r of rows) {
    ts.push(Math.floor(r.capturedAt.getTime() / 1000));
    const w = r.webVitals["7d"];
    lcp.push(goodRatio(w.lcp));
    inp.push(goodRatio(w.inp));
    cls.push(goodRatio(w.cls));
    ttfb.push(goodRatio(w.ttfb));
  }
  return { ts, lcp, inp, cls, ttfb };
}

export function hasAnyWebVitalSamples(s: WebVitalRatioSeries): boolean {
  return (
    s.lcp.some((v) => v !== null) ||
    s.inp.some((v) => v !== null) ||
    s.cls.some((v) => v !== null) ||
    s.ttfb.some((v) => v !== null)
  );
}
