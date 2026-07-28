import type { APIRoute } from "astro";
import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { generatePresignedPutURL } from "../../../../lib/r2-presigned";
import { isSafeSlug, type AssetKind } from "../../../../lib/asset-key";

export const prerender = false;

const KINDS = ["hero", "content"];

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const filename = url.searchParams.get("filename");
  const contentType = url.searchParams.get("contentType");
  const kind = url.searchParams.get("kind") ?? "hero";

  if (!slug || !filename || !contentType)
    return jsonErr("slug, filename and contentType are required", 400);

  if (!isSafeSlug(slug)) return jsonErr("slug must be lowercase alphanumeric with hyphens", 400);
  if (!KINDS.includes(kind)) return jsonErr(`kind must be one of ${KINDS}`, 400);
  // SVG is excluded deliberately: astro:assets treats it differently and it can carry script.
  if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(contentType))
    return jsonErr(`unsupported content type: ${contentType}`, 415);

  const [result, error] = await tryCatch(
    generatePresignedPutURL(
      { slug, filename, contentType, kind: kind as AssetKind },
      {
        accountId: import.meta.env.CF_ACCOUNT_ID,
        bucketName: import.meta.env.R2_BUCKET_NAME,
        accessKey: import.meta.env.R2_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY,
      }
    )
  );

  if (error) {
    console.error("Generate presigned URL failed: ", error);
    return jsonErr("Failed to generate upload URL", 500);
  }

  return new Response(JSON.stringify({ ok: true, url: result.url, key: result.key, contentType }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
