import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface PresignedURLConfig {
  accountId: string;
  bucketName: string;
  accessKey: string;
  secretAccessKey: string;
}

const EXPIRY_SECONDS = 300;

export async function generatePresignedPutURL(
  slug: string,
  filename: string,
  config: PresignedURLConfig
): Promise<{ url: string; key: string }> {
  const ext = filename.split(".").pop() ?? "jpg";
  const random = crypto.randomUUID().split("-")[0];
  const key = `hero-images/${slug}-${random}.${ext}`;

  const client = new S3Client({
    region: "auto", // Cloudflare always 'auto'
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    { expiresIn: EXPIRY_SECONDS }
  );

  client.destroy(); // Ensure that no hanging interal HTTP agent keeping the worker alive

  return { url, key };
}
