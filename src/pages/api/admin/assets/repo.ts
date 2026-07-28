import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { isSafeAssetKey } from "../../../../lib/asset-key";
import { ghApi } from "../../../../lib/github";

export const prerender = false;

// Staging is emptied independently of the repo, so the repo copy outlives a publish.
export const GET: APIRoute = async ({ request }) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !isSafeAssetKey(key)) return new Response("Invalid key", { status: 400 });

  // Raw answers `application/octet-stream`, which an `<img>` need not render.
  const contentType = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  }[key.split(".").pop()?.toLowerCase() ?? ""];

  if (!contentType) return new Response("Unsupported image type", { status: 415 });

  const [resp, error] = await tryCatch(
    // `ref=main` keeps an image visible between its publish and the end of that deploy.
    ghApi(`/contents/src/content/blog/${key}?ref=main`, {
      headers: { Accept: "application/vnd.github.raw" },
    })
  );
  if (error) return new Response("Not found", { status: 404 });

  return new Response(resp.body, {
    headers: {
      "Content-Type": contentType,
      // Keys embed a random component, so contents never change.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};
