import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeAssetFilename, type AssetKind } from "./asset-key";

interface PresignedURLConfig {
  accountId: string;
  bucketName: string;
  accessKey: string;
  secretAccessKey: string;
}

export interface PresignRequest {
  slug: string;
  filename: string;
  /** Must match the `Content-Type` header the browser sends on the PUT. */
  contentType: string;
  kind: AssetKind;
}

const EXPIRY_SECONDS = 300;

/**
 * Hero keys stay flat for continuity with articles already published from the
 * admin panel; content keys are grouped per slug so an article's inline assets
 * sit together in the repo. Both satisfy `src/content/blog/${key}`.
 */
function buildKey({ kind, slug, filename }: PresignRequest): string {
  const { stem, ext } = sanitizeAssetFilename(filename);
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
    region: "auto", // Cloudflare always 'auto'
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretAccessKey,
    },
  });

  // ContentType is part of the signature, so the browser's PUT must send this
  // exact header or R2 answers SignatureDoesNotMatch. Signing it is worth that
  // constraint: R2 then stores the real type, which the staging proxy echoes
  // back to the editor preview.
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: request.contentType,
    }),
    { expiresIn: EXPIRY_SECONDS }
  );

  client.destroy(); // Ensure that no hanging interal HTTP agent keeping the worker alive

  return { url, key };
}
