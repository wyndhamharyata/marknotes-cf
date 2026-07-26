import type { APIRoute } from "astro";
import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { generatePresignedPutURL } from "../../../../lib/r2-presigned";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const filename = url.searchParams.get("filename");

  if (!slug || !filename)
    return new Response(JSON.stringify({ error: "slug and filename are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  const [result, error] = await tryCatch(
    generatePresignedPutURL(slug, filename, {
      accountId: import.meta.env.CF_ACCOUNT_ID,
      bucketName: import.meta.env.R2_BUCKET_NAME,
      accessKey: import.meta.env.R2_ACCESS_KEY_ID,
      secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY,
    })
  );

  if (error) {
    console.error("Generate presigned URL failed: ", error);
    return new Response(
      JSON.stringify({
        error: "Faiield to generate upload URL",
        detail: error instanceof Error ? error.message : "Unknown",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      url: result.url,
      key: result.key,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
