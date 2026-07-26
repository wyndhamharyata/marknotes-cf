/**
 * Applies the CORS policy the admin editor needs on the image staging bucket.
 *
 * The editor uploads straight from the browser to a presigned R2 URL, so R2
 * itself has to allow the cross-origin PUT — nothing in the worker can grant
 * it. `sst.cloudflare.Bucket` does not surface CORS configuration, hence this
 * one-off script.
 *
 * Uses the Cloudflare REST API rather than the S3 `PutBucketCors` call: bucket
 * configuration is an admin-scoped operation, and the R2 access keys are
 * object-scoped, so the S3 route answers 403 AccessDenied.
 *
 *   npx sst shell --stage production -- npx tsx scripts/r2-cors.ts
 *   npx sst shell --stage production -- npx tsx scripts/r2-cors.ts --apply
 *
 * Prints the intended policy and exits without writing unless --apply is given.
 * Each stage has its own bucket, so run it once per stage you upload from.
 */

// No imports are needed (plain fetch), but top-level await requires TypeScript
// to see this file as a module.
export {};

/**
 * The browser sends whichever host the admin page was loaded from, and this app
 * answers on more than one: sst.config deploys production to `mwyndham.dev`
 * while astro.config's `site` is `blog.mwyndham.dev`. Both are listed so the
 * upload works regardless of which one you open /admin on.
 */
const DEFAULT_ORIGINS = [
  "https://mwyndham.dev",
  "https://blog.mwyndham.dev",
  "https://devread.mwyndham.dev",
  "http://localhost:4321",
];

/**
 * `sst shell` exposes linked resources as SST_RESOURCE_<Name> JSON. It does not
 * replay the Astro component's `environment` block — those names (R2_BUCKET_NAME
 * and friends) only exist inside the deployed worker — so read the resources
 * directly, falling back to plain env vars for a non-SST invocation.
 */
function resourceField(name: string, field: string): string | undefined {
  const raw = process.env[`SST_RESOURCE_${name}`];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function requireValue(value: string | undefined, hint: string): string {
  if (!value) {
    console.error(
      `Missing ${hint}.\nRun inside sst shell:\n  npx sst shell --stage <stage> -- npx tsx scripts/r2-cors.ts`
    );
    process.exit(1);
  }
  return value;
}

const accountId = requireValue(
  resourceField("CfAccountId", "value") ?? process.env.CF_ACCOUNT_ID,
  "CfAccountId"
);
const bucketName = requireValue(
  resourceField("ImageStagingBucket", "name") ?? process.env.R2_BUCKET_NAME,
  "ImageStagingBucket"
);
/**
 * CLOUDFLARE_API_TOKEN (from .env, the same one CI deploys with) is checked
 * first because it is the one that actually carries R2 admin scope. The
 * SST `R2CloudflareAPIToken` secret currently fails /user/tokens/verify with
 * "Invalid API Token", and nothing in the app reads it, so it is only a
 * last-resort fallback here.
 */
const apiToken = requireValue(
  process.env.CLOUDFLARE_API_TOKEN ??
    process.env.R2_CLOUDFLARE_API_TOKEN ??
    resourceField("R2CloudflareAPIToken", "value"),
  "CLOUDFLARE_API_TOKEN (needs R2 admin write on this account)"
);

const origins = process.env.R2_CORS_ORIGINS?.split(",").map((o) => o.trim()) ?? DEFAULT_ORIGINS;
const apply = process.argv.includes("--apply");

// PUT only: the browser never reads from R2 directly, since the staging bucket
// has no public domain and reads go through /api/admin/assets/object.
// `content-type` must be allowed because it is part of the presigned signature.
const rules = [
  {
    id: "admin-editor-uploads",
    allowed: {
      origins,
      methods: ["PUT"],
      headers: ["content-type"],
    },
    maxAgeSeconds: 3600,
  },
];

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`;

interface CloudflareResponse {
  success: boolean;
  errors: { code: number; message: string }[];
  result?: unknown;
}

async function callApi(method: "GET" | "PUT", body?: unknown): Promise<CloudflareResponse> {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as CloudflareResponse | null;
  if (!payload) throw new Error(`${method} ${response.status}: unreadable response`);
  return payload;
}

console.log(`bucket:  ${bucketName}`);
console.log(`origins: ${origins.join(", ")}`);
console.log(`policy:  ${JSON.stringify(rules, null, 2)}`);

// Report a read failure as a failure. Swallowing it would make a permissions
// problem look identical to "no policy configured" — which is exactly the
// confusion that hid an AccessDenied behind a reassuring "(none set)".
const NO_CORS_CONFIGURED = 10059;

const current = await callApi("GET");
if (current.success) {
  console.log(`\ncurrent: ${JSON.stringify(current.result ?? {}, null, 2)}`);
} else if (current.errors.some((e) => e.code === NO_CORS_CONFIGURED)) {
  console.log("\ncurrent: (none configured)");
} else {
  console.log(`\ncurrent: COULD NOT READ — ${formatErrors(current)}`);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write this policy.");
  process.exit(0);
}

const applied = await callApi("PUT", { rules });
if (!applied.success) {
  console.error(`\nFailed to apply: ${formatErrors(applied)}`);
  console.error("The token needs the 'Workers R2 Storage: Edit' permission on this account.");
  process.exit(1);
}

const verified = await callApi("GET");
console.log(`\napplied: ${JSON.stringify(verified.result ?? {}, null, 2)}`);

function formatErrors(response: CloudflareResponse): string {
  if (response.errors.length === 0) return "unknown error";
  return response.errors.map((e) => `[${e.code}] ${e.message}`).join("; ");
}
