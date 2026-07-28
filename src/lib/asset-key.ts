export type AssetKind = "hero" | "content";

// Keys become repository paths, so a traversal would overwrite arbitrary files.
export function isSafeAssetKey(key: string): boolean {
  if (
    key.length > 200 ||
    !/^(?:hero-images|content-images)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)
  )
    return false;
  return key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function isSafeSlug(slug: string): boolean {
  return slug.length <= 120 && /^[a-z0-9][a-z0-9-]*$/.test(slug);
}
