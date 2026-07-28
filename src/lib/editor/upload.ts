import type { AssetKind } from "../asset-key";
import { compressImage } from "./compress";

/** R2 staging has no public domain, so reads go back through the admin worker. */
export function stagedAssetUrl(r2Key: string): string {
  return `/api/admin/assets/object?key=${encodeURIComponent(r2Key)}`;
}

// Staging is emptied independently of the repo, so the repo copy outlives a publish.
export function repoAssetUrl(key: string): string {
  return `/api/admin/assets/repo?key=${encodeURIComponent(key)}`;
}

export async function uploadAsset(
  file: File,
  slug: string,
  kind: AssetKind
): Promise<{ key: string }> {
  // Compression rewrites the MIME type, and the presigned URL signs Content-Type.
  const compressed = await compressImage(file, kind);

  const query = new URLSearchParams({
    slug,
    kind,
    filename: compressed.filename,
    contentType: compressed.contentType,
  });

  const presignResponse = await fetch(`/api/admin/assets/bucket-upload?${query}`);
  if (!presignResponse.ok) {
    const body = (await presignResponse.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Upload URL request failed (${presignResponse.status})`);
  }

  const presigned = (await presignResponse.json()) as { url: string; key: string };

  const putResponse = await fetch(presigned.url, {
    method: "PUT",
    headers: { "Content-Type": compressed.contentType },
    body: compressed.blob,
  });

  if (!putResponse.ok) {
    throw new Error(`Upload failed (${putResponse.status}). Check the bucket's CORS policy.`);
  }

  return { key: presigned.key };
}
