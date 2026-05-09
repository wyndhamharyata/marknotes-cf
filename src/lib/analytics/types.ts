export interface PageVisit {
  pageviews: number;
  visits: number;
}

export interface WebVital {
  good: number;
  needsImprovement: number;
  bad: number;
}

export interface WebVitalGroup {
  lcp: WebVital;
  inp: WebVital;
  fid: WebVital;
  cls: WebVital;
  ttfb: WebVital;
}

export type AnalyticsWindow = "24h" | "7d" | "30d";

export interface AnalyticsSnapshot {
  pageVisit24h: PageVisit;
  pageVisit7d: PageVisit;
  pageVisit30d: PageVisit;
  webVital24h: WebVitalGroup;
  webVital7d: WebVitalGroup;
  webVital30d: WebVitalGroup;
}

export interface ArticleAnalyticsRow {
  articleSlug: string;
  pageviews24h: number;
  visits24h: number;
  pageviews7d: number;
  visits7d: number;
  pageviews30d: number;
  visits30d: number;
  webVitals: Record<AnalyticsWindow, WebVitalGroup>;
  capturedAt: Date;
}

export const EMPTY_WEB_VITAL: WebVital = { good: 0, needsImprovement: 0, bad: 0 };

export const EMPTY_WEB_VITAL_GROUP: WebVitalGroup = {
  lcp: EMPTY_WEB_VITAL,
  inp: EMPTY_WEB_VITAL,
  fid: EMPTY_WEB_VITAL,
  cls: EMPTY_WEB_VITAL,
  ttfb: EMPTY_WEB_VITAL,
};
