import type { AssetKind } from "../asset-key";
import { compressImage, HERO_MAX_WIDTH, INLINE_MAX_WIDTH } from "./compress";

interface PresignResponse {
  ok: true;
  url: string;
  key: string;
  contentType: string;
}

/** Reads a staged upload back through the admin worker; R2 has no public domain. */
export function stagedAssetUrl(r2Key: string): string {
  return `/api/admin/assets/object?key=${encodeURIComponent(r2Key)}`;
}

/** True when the staged object is still there — the lifecycle rule expires them. */
export async function stagedAssetExists(r2Key: string): Promise<boolean> {
  try {
    const response = await fetch(stagedAssetUrl(r2Key), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Compress, presign, PUT. Compression has to come first: it rewrites both the
 * filename and the MIME type, and the presigned URL signs `Content-Type`, so
 * presigning ahead of it would sign the wrong header and R2 would answer
 * SignatureDoesNotMatch.
 */
export async function uploadAsset(
  file: File,
  slug: string,
  kind: AssetKind
): Promise<{ key: string }> {
  const compressed = await compressImage(file, kind === "hero" ? HERO_MAX_WIDTH : INLINE_MAX_WIDTH);

  if (!compressed.contentType) {
    throw new Error(`Could not determine the image type of ${file.name}`);
  }

  const query = new URLSearchParams({
    slug,
    kind,
    filename: compressed.filename,
    contentType: compressed.contentType,
  });

  const presignResponse = await fetch(`/api/admin/assets/bucket-upload?${query}`);
  if (!presignResponse.ok) throw new Error(await errorMessage(presignResponse));

  const presigned = (await presignResponse.json()) as PresignResponse;

  // The header must match the signed ContentType exactly, so set it explicitly
  // rather than relying on fetch inferring it from the blob.
  const putResponse = await fetch(presigned.url, {
    method: "PUT",
    headers: { "Content-Type": presigned.contentType },
    body: compressed.blob,
  });

  if (!putResponse.ok) {
    throw new Error(`Upload failed (${putResponse.status}). Check the bucket's CORS policy.`);
  }

  return { key: presigned.key };
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed with ${response.status}`;
}
