import {
  EMPTY_WEB_VITAL_GROUP,
  type AnalyticsSnapshot,
  type PageVisit,
  type WebVital,
  type WebVitalGroup,
} from "./types";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

export interface FetchAnalyticsArgs {
  accountTag: string;
  siteTag: string;
  token: string;
  email: string;
  slug: string;
  endTime?: Date;
}

export async function fetchArticleAnalytics(
  args: FetchAnalyticsArgs,
): Promise<AnalyticsSnapshot> {
  const path = `/articles/${args.slug}/`;
  const now = args.endTime ?? new Date();

  const windows: { key: AnalyticsWindowKey; start: Date }[] = [
    { key: "24h", start: addDays(now, -1) },
    { key: "7d", start: addDays(now, -7) },
    { key: "30d", start: addMonths(now, -1) },
  ];

  const query = buildQuery(args.accountTag, args.siteTag, path, now, windows);

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "x-auth-email": args.email,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(
      `Cloudflare GraphQL ${res.status} ${res.statusText} for slug=${args.slug}`,
    );
  }

  const json = (await res.json()) as GraphQLResponse;

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Cloudflare GraphQL errors for slug=${args.slug}: ${json.errors
        .map((e) => e.message)
        .join("; ")}`,
    );
  }

  const account = json.data?.viewer?.accounts?.[0];
  if (!account) {
    throw new Error(`Cloudflare GraphQL: missing viewer.accounts[0] for slug=${args.slug}`);
  }

  return {
    pageVisit24h: toPageVisit(account.pageVisits24h),
    pageVisit7d: toPageVisit(account.pageVisits7d),
    pageVisit30d: toPageVisit(account.pageVisits30d),
    webVital24h: toWebVitalGroup(account.webVitals24h),
    webVital7d: toWebVitalGroup(account.webVitals7d),
    webVital30d: toWebVitalGroup(account.webVitals30d),
  };
}

type AnalyticsWindowKey = "24h" | "7d" | "30d";

interface GraphQLResponse {
  data?: {
    viewer?: {
      accounts?: AccountResult[];
    };
  };
  errors?: { message: string }[];
}

interface AccountResult {
  pageVisits24h?: PageVisitRow[];
  pageVisits7d?: PageVisitRow[];
  pageVisits30d?: PageVisitRow[];
  webVitals24h?: WebVitalRow[];
  webVitals7d?: WebVitalRow[];
  webVitals30d?: WebVitalRow[];
}

interface PageVisitRow {
  pageViews?: number;
  visits?: { visits?: number };
}

interface WebVitalRow {
  data?: Record<string, number | null | undefined>;
}

function toPageVisit(rows: PageVisitRow[] | undefined): PageVisit {
  const row = rows?.[0];
  if (!row) return { pageviews: 0, visits: 0 };
  return {
    pageviews: numberOr0(row.pageViews),
    visits: numberOr0(row.visits?.visits),
  };
}

function toWebVitalGroup(rows: WebVitalRow[] | undefined): WebVitalGroup {
  const row = rows?.[0];
  if (!row?.data) return EMPTY_WEB_VITAL_GROUP;
  const d = row.data;
  return {
    lcp: vitalFor(d, "lcp"),
    inp: vitalFor(d, "inp"),
    fid: vitalFor(d, "fid"),
    cls: vitalFor(d, "cls"),
    ttfb: vitalFor(d, "ttfb"),
  };
}

function vitalFor(d: Record<string, number | null | undefined>, prefix: string): WebVital {
  return {
    good: numberOr0(d[`${prefix}Good`]),
    needsImprovement: numberOr0(d[`${prefix}NeedsImprovement`]),
    bad: numberOr0(d[`${prefix}Poor`]),
  };
}

function numberOr0(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

function buildQuery(
  accountTag: string,
  siteTag: string,
  path: string,
  end: Date,
  windows: { key: AnalyticsWindowKey; start: Date }[],
): string {
  const endStr = end.toISOString();

  const pageVisitBlocks = windows
    .map((w) =>
      pageVisitBlock(`pageVisits${w.key}`, w.start.toISOString(), endStr, siteTag, path),
    )
    .join("\n");

  const webVitalBlocks = windows
    .map((w) =>
      webVitalBlock(`webVitals${w.key}`, w.start.toISOString(), endStr, siteTag, path),
    )
    .join("\n");

  return `
    query {
      viewer {
        accounts(filter: { accountTag: "${accountTag}" }) {
          ${pageVisitBlocks}
          ${webVitalBlocks}
        }
      }
    }
  `;
}

function pageVisitBlock(
  alias: string,
  start: string,
  end: string,
  siteTag: string,
  path: string,
): string {
  return `
    ${alias}: rumPageloadEventsAdaptiveGroups(
      filter: {
        AND: [
          { datetime_geq: "${start}", datetime_leq: "${end}" }
          { OR: [{ siteTag: "${siteTag}" }] }
          { bot: 0 }
          { requestPath: "${path}" }
        ]
      }
      limit: 1
    ) {
      pageViews: count
      visits: sum { visits }
    }
  `;
}

function webVitalBlock(
  alias: string,
  start: string,
  end: string,
  siteTag: string,
  path: string,
): string {
  return `
    ${alias}: rumWebVitalsEventsAdaptiveGroups(
      filter: {
        AND: [
          { datetime_geq: "${start}", datetime_leq: "${end}" }
          { OR: [{ siteTag: "${siteTag}" }] }
          { bot: 0 }
          { requestPath: "${path}" }
        ]
      }
      limit: 1
    ) {
      data: sum {
        lcpGood
        lcpNeedsImprovement
        lcpPoor
        ttfbGood
        ttfbNeedsImprovement
        ttfbPoor
        clsGood
        clsNeedsImprovement
        clsPoor
        fidGood
        fidNeedsImprovement
        fidPoor
        inpGood
        inpNeedsImprovement
        inpPoor
      }
    }
  `;
}
