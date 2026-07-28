import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { minLength, string, nonEmpty, pipe, object, optional, safeParse, array } from "valibot";
import { Resource } from "sst/resource";
import { commitMdx } from "../../../../lib/github";
import { isSafeAssetKey, isSafeSlug } from "../../../../lib/asset-key";

export const prerender = false;

const SaveReqSchema = object({
  slug: pipe(string(), nonEmpty(), minLength(1, "slug is required")),
  content: pipe(string(), nonEmpty(), minLength(1, "content is required")),
  imageKey: optional(string()),
  inlineImageKeys: optional(array(string())),
  removedKeys: optional(array(string())),
});

// Each asset costs an R2 read plus a blob POST; the byte cap bounds the base64 pass.
const MAX_ASSETS = 20;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const save: APIRoute = async ({ request }) => {
  const [rawReq, parseErr] = await tryCatch(request.json());
  if (parseErr) return jsonErr("Invalid JSON", 400);

  const result = safeParse(SaveReqSchema, rawReq);
  if (!result.success)
    return jsonErr(`Validation failed: ${result.issues.map((i) => i.message).join(", ")}`, 400);

  const { slug, content, imageKey, inlineImageKeys = [], removedKeys = [] } = result.output;

  if (!isSafeSlug(slug)) return jsonErr("slug must be lowercase alphanumeric with hyphens", 400);

  const keys = [...new Set([...(imageKey ? [imageKey] : []), ...inlineImageKeys])];

  for (const key of keys) {
    if (!isSafeAssetKey(key)) return jsonErr(`Invalid asset key: ${key}`, 400);
  }

  if (keys.length > MAX_ASSETS)
    return jsonErr(`Too many images: ${keys.length} (max ${MAX_ASSETS})`, 400);

  const removals = [...new Set(removedKeys)];
  if (removals.length > 50) return jsonErr(`Too many deletions: ${removals.length} (max 50)`, 400);

  const heroPrefix = `hero-images/${slug}-`;
  for (const key of removals) {
    // Confines deletes to this slug: the hyphen test is why `foo` cannot delete `foo-bar`'s hero.
    const owned =
      key.startsWith(`content-images/${slug}/`) ||
      (key.startsWith(heroPrefix) && !key.slice(heroPrefix.length).includes("-"));

    if (!isSafeAssetKey(key) || !owned)
      return jsonErr(`Cannot delete an asset outside this article: ${key}`, 400);
    if (content.includes(key)) return jsonErr(`Asset is still referenced: ${key}`, 400);
  }

  const [assets, assetErr] = await tryCatch(collectAssets(keys));
  if (assetErr) return jsonErr(assetErr instanceof Error ? assetErr.message : "Asset error", 400);

  const [commitRes, commitErr] = await tryCatch(
    commitMdx({
      slug,
      mdxContent: content,
      message:
        request.method === "PUT"
          ? `content: edit from admin panel - ${slug}`
          : `content: new content push from admin panel - ${slug}`,
      assets,
      removedKeys: removals,
    })
  );

  if (commitErr) {
    console.error("Save failed: ", commitErr);
    return jsonErr(commitErr instanceof Error ? commitErr.message : "Failed to save", 500);
  }

  return new Response(JSON.stringify({ ok: true, sha: commitRes.sha }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST = save;
export const PUT = save;

async function collectAssets(keys: string[]) {
  if (keys.length === 0) return [];

  const bucket = Resource.ImageStagingBucket;
  const objects = await Promise.all(keys.map((key) => bucket.get(key)));

  const missing = keys.filter((_, i) => !objects[i]);
  if (missing.length > 0)
    throw new Error(`Images no longer in staging, please re-upload: ${missing.join(", ")}`);

  // R2 returns a stream, so size is known before any bytes are buffered.
  const totalBytes = objects.reduce((sum, object) => sum + (object?.size ?? 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES)
    throw new Error(
      `Images total ${(totalBytes / 1024 / 1024).toFixed(1)}MB, over the ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit`
    );

  return Promise.all(
    objects.map(async (object, i) => ({ r2Key: keys[i], buffer: await object!.arrayBuffer() }))
  );
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
