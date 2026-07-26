import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import {
  minLength,
  string,
  nonEmpty,
  pipe,
  object,
  optional,
  parse,
  safeParse,
  instance,
} from "valibot";
import { commitMdx } from "../../../../lib/github-commit";

export const prerender = false;

const PostRequestBodySchema = object({
  slug: pipe(string(), nonEmpty(), minLength(1, "slug is required")),
  content: pipe(string(), nonEmpty(), minLength(1, "content is required")),
  imageKey: optional(string()),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const [rawReq, parseErr] = await tryCatch(request.json());
  if (parseErr) jsonErr("Invalid JSON", 400);

  const result = safeParse(PostRequestBodySchema, rawReq);
  if (!result.success)
    return jsonErr(`Validation failed: ${result.issues.map((i) => i.message).join(", ")}`, 400);

  const { slug, content, imageKey } = result.output;

  let imageBuffer = new ArrayBuffer(0);

  if (imageKey) {
    const bucket = getBucket(locals);

    if (!bucket) return jsonErr("Image bucket not available", 500);

    const imageObject = await bucket.get(imageKey);
    if (!imageObject) return jsonErr(`Iamge not found in the bucket: ${imageKey}`, 404);

    imageBuffer = await imageObject.arrayBuffer();
  }

  const [commitRes, commitErr] = await tryCatch(
    commitMdx({
      slug,
      imageBuffer,
      mdxContent: content,
      imageR2Key: imageKey,
    })
  );

  if (commitErr) {
    console.error("Save failed: ", commitErr);
    return jsonErr(commitErr instanceof Error ? commitErr.message : "Failed to save", 500);
  }

  return new Response(
    JSON.stringify({ ok: commitRes.ok, message: "Saved! Site will update in ~3 minutes" })
  );
};

function getBucket(locals: App.Locals): R2Bucket | undefined {
  const env = (locals as unknown as { runtime?: { env?: Record<string, unknown> } }).runtime?.env;
  return env?.IMAGE_STAGING_BUCKET as R2Bucket | undefined;
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
