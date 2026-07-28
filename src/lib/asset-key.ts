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

/** The 8 hex digits `buildKey` takes from a UUID, plus the extension. */
const HERO_SUFFIX = /^[0-9a-f]{8}\.[a-z0-9-]{1,8}$/;

/**
 * Whether deleting `key` is this article's business.
 *
 * Editing may orphan an image, and only the owning article may remove it. The
 * hero check reads the random suffix rather than stopping at the prefix, or
 * `foo` would be entitled to delete `hero-images/foo-bar-1234abcd.png` — which
 * belongs to `foo-bar`. Legacy heroes under `src/assets` are not asset keys at
 * all, so they are never deletable.
 */
export function ownsAssetKey(key: string, slug: string): boolean {
  if (!isSafeAssetKey(key) || !isSafeSlug(slug)) return false;

  if (key.startsWith(`content-images/${slug}/`)) return true;

  const heroPrefix = `hero-images/${slug}-`;
  return key.startsWith(heroPrefix) && HERO_SUFFIX.test(key.slice(heroPrefix.length));
}
