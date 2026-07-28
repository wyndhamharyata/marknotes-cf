import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { isSafeAssetKey } from "../../../../lib/asset-key";
import { readRepoFile } from "../../../../lib/github";

export const prerender = false;

// The raw media type answers `application/octet-stream`, which is not a type an
// `<img>` is obliged to render, so the extension decides instead.
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * Reads an image an earlier publish committed, for the editor preview.
 *
 * Staging is emptied independently of the repo, so once an article is published
 * its own copy is the only one left. Reading `main` rather than the built
 * collection also keeps a just-published image visible before its deploy lands.
 */
export const GET: APIRoute = async ({ request }) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !isSafeAssetKey(key)) return new Response("Invalid key", { status: 400 });

  const contentType = MIME[key.split(".").pop()?.toLowerCase() ?? ""];
  if (!contentType) return new Response("Unsupported image type", { status: 415 });

  const [resp, error] = await tryCatch(readRepoFile(`src/content/blog/${key}`));
  if (error) return new Response("Upstream error", { status: 502 });
  if (!resp) return new Response("Not found", { status: 404 });

  return new Response(resp.body, {
    headers: {
      "Content-Type": contentType,
      // Keys embed a random component, so contents never change.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};
