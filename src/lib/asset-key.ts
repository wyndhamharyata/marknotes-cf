export type AssetKind = "hero" | "content";

const KEY = /^(?:hero-images|content-images)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// Keys and slugs are supplied by the browser and become repository paths, so a
// traversal here would let the editor overwrite arbitrary files.
export function isSafeAssetKey(key: string): boolean {
  if (key.length > 200 || !KEY.test(key)) return false;
  return key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function isSafeSlug(slug: string): boolean {
  return slug.length <= 120 && SLUG.test(slug);
}
