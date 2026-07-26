import type { APIRoute } from "astro";
import { Resource } from "sst/resource";
import { isSafeAssetKey } from "../../../../lib/asset-key";

export const prerender = false;

/**
 * Reads a staged upload back out of R2. Presigning only grants PUT and the
 * bucket has no public domain, so this is the editor's only way to display an
 * image it just uploaded.
 */
export const GET: APIRoute = async ({ request }) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !isSafeAssetKey(key)) return new Response("Invalid key", { status: 400 });

  const object = await Resource.ImageStagingBucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": object.size.toString(),
      ETag: object.httpEtag,
      // Keys embed a random component, so contents never change.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};
