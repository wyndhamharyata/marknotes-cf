import type { AssetKind } from "./asset-key";

interface PresignedURLConfig {
  accountId: string;
  bucketName: string;
  accessKey: string;
  secretAccessKey: string;
}

export interface PresignRequest {
  slug: string;
  filename: string;
  contentType: string;
  kind: AssetKind;
}

const EXPIRY_SECONDS = 300;
const REGION = "auto";
const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

function clean(value: string, maxLength: number, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return cleaned || fallback;
}

// Both shapes satisfy `src/content/blog/${key}`, which is where commitMdx puts them.
function buildKey({ kind, slug, filename }: PresignRequest): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = clean(dot > 0 ? base.slice(0, dot) : base, 60, "image");
  const ext = clean(dot > 0 ? base.slice(dot + 1) : "", 8, "bin");
  const random = crypto.randomUUID().split("-")[0];

  return kind === "hero"
    ? `hero-images/${slug}-${random}.${ext}`
    : `content-images/${slug}/${random}-${stem}.${ext}`;
}

// RFC 3986: the browser must PUT the exact same path, so encode every segment but the slashes.
const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(data: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data)));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

/**
 * A presigned PUT URL for R2, signed with SigV4.
 *
 * This used to be `@aws-sdk/client-s3`. The SDK's node-only helpers are replaced by sentinels in
 * its browser build, and Vite resolved that build for the server bundle too, so presigning threw
 * "emitWarningIfUnsupportedVersion is not a function". Signing here is a few lines and bundles as
 * nothing, which also keeps the worker small.
 */
export async function generatePresignedPutURL(
  request: PresignRequest,
  config: PresignedURLConfig
): Promise<{ url: string; key: string }> {
  const key = buildKey(request);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  // e.g. 20261031T061500Z
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(EXPIRY_SECONDS),
    "X-Amz-SignedHeaders": "host",
  });
  // R2 (like S3) wants the query sorted and encoded the way the signer wrote it.
  const canonicalQuery = [...query.entries()]
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .sort()
    .join("&");

  const canonicalUri = `/${encode(config.bucketName)}/${key.split("/").map(encode).join("/")}`;

  // Payload is unsigned: the browser streams it after this URL is handed out.
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = await hmac(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), dateStamp);
  const regionKey = await hmac(dateKey, REGION);
  const serviceKey = await hmac(regionKey, SERVICE);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));

  return {
    url: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    key,
  };
}
