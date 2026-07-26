import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { minLength, string, nonEmpty, pipe, object, optional, safeParse, array } from "valibot";
import { Resource } from "sst/resource";
import { commitMdx } from "../../../../lib/github-commit";
import { isSafeAssetKey, isSafeSlug } from "../../../../lib/asset-key";

export const prerender = false;

const PostRequestBodySchema = object({
  slug: pipe(string(), nonEmpty(), minLength(1, "slug is required")),
  content: pipe(string(), nonEmpty(), minLength(1, "content is required")),
  imageKey: optional(string()),
  inlineImageKeys: optional(array(string())),
});

// Each asset costs an R2 read plus a GitHub blob POST on top of the ~5
// subrequests the ref/tree/commit dance needs; the byte cap keeps the base64
// pass inside the CPU budget.
const MAX_ASSETS = 20;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const [rawReq, parseErr] = await tryCatch(request.json());
  if (parseErr) return jsonErr("Invalid JSON", 400);

  const result = safeParse(PostRequestBodySchema, rawReq);
  if (!result.success)
    return jsonErr(`Validation failed: ${result.issues.map((i) => i.message).join(", ")}`, 400);

  const { slug, content, imageKey, inlineImageKeys = [] } = result.output;

  if (!isSafeSlug(slug)) return jsonErr("slug must be lowercase alphanumeric with hyphens", 400);

  const keys = [...new Set([...(imageKey ? [imageKey] : []), ...inlineImageKeys])];

  for (const key of keys) {
    if (!isSafeAssetKey(key)) return jsonErr(`Invalid asset key: ${key}`, 400);
  }

  if (keys.length > MAX_ASSETS)
    return jsonErr(`Too many images: ${keys.length} (max ${MAX_ASSETS})`, 400);

  const [assets, assetErr] = await tryCatch(collectAssets(keys));
  if (assetErr) return jsonErr(assetErr instanceof Error ? assetErr.message : "Asset error", 400);

  const [commitRes, commitErr] = await tryCatch(commitMdx({ slug, mdxContent: content, assets }));

  if (commitErr) {
    console.error("Save failed: ", commitErr);
    return jsonErr(commitErr instanceof Error ? commitErr.message : "Failed to save", 500);
  }

  return new Response(
    JSON.stringify({ ok: commitRes.ok, message: "Saved! Site will update in ~3 minutes" })
  );
};

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
