/**
 * Staging asset keys originate in the browser and are turned into repository
 * paths verbatim (`src/content/blog/${key}` — see `repoPathForAssetKey`). A key
 * that escapes that prefix would let the editor overwrite arbitrary files in
 * the repo, `.github/workflows/deploy.yml` included, so every key crossing the
 * wire is validated here before it reaches R2 or the Git tree.
 */

export type AssetKind = "hero" | "content";

/**
 * Upload MIME allowlist. This is the boundary that stops the presign endpoint
 * from becoming a general "write any file into the repo" API: the bytes that
 * eventually get committed are whatever the browser PUT, so the type gate has
 * to sit at presign time rather than at commit time.
 *
 * SVG is deliberately absent — `astro:assets` treats it differently from raster
 * formats and it carries script.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

const KEY_RE = /^(?:hero-images|content-images)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const MAX_KEY_LENGTH = 200;
const MAX_SLUG_LENGTH = 120;

export function isSafeAssetKey(key: string): boolean {
  if (key.length > MAX_KEY_LENGTH || !KEY_RE.test(key)) return false;

  // The tail character class permits `.` and `/`, so the regex alone still
  // matches "content-images/a/../../x" and "content-images/a//b".
  return key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function isSafeSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && SLUG_RE.test(slug);
}

/**
 * The single rule mapping staging storage to the repo. Keeping every asset
 * under `src/content/blog/` also keeps them inside the deploy workflow's
 * `src/content/blog/**` path filter.
 */
export function repoPathForAssetKey(key: string): string {
  return `src/content/blog/${key}`;
}

/**
 * Reduce a user-supplied filename to characters that are safe in both an R2 key
 * and a Git path. Returns the parts separately because hero and content keys
 * assemble them differently.
 */
export function sanitizeAssetFilename(filename: string): { stem: string; ext: string } {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");

  const rawStem = dot > 0 ? base.slice(0, dot) : base;
  const rawExt = dot > 0 ? base.slice(dot + 1) : "";

  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const stem = clean(rawStem).slice(0, 60) || "image";
  const ext = clean(rawExt).slice(0, 8) || "bin";

  return { stem, ext };
}
