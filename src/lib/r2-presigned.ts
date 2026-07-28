import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export async function generatePresignedPutURL(
  request: PresignRequest,
  config: PresignedURLConfig
): Promise<{ url: string; key: string }> {
  const key = buildKey(request);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretAccessKey,
    },
  });

  // ContentType is signed, so the browser's PUT must send this exact header.
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: request.contentType,
    }),
    { expiresIn: EXPIRY_SECONDS }
  );

  client.destroy(); // otherwise its HTTP agent keeps the worker alive

  return { url, key };
}
