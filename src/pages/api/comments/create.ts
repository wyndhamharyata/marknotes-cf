import type { APIRoute } from "astro";
import { createComment } from "../../../lib/comments/repository";
import { getOrCreateAlias } from "../../../lib/comments/diceware";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const articleSlug = formData.get("articleSlug") as string;
  const replyBody = formData.get("replyBody") as string;
  const parentIdStr = formData.get("parentId") as string;

  // Validation
  if (!replyBody?.trim()) {
    return new Response("Comment body cannot be empty", { status: 400 });
  }

  if (!articleSlug) {
    return new Response("Article slug is required", { status: 400 });
  }

  // Get or create alias from cookie
  const alias = getOrCreateAlias(cookies);

  // Parse parentId
  const parentId = parentIdStr && parentIdStr !== "0" && parentIdStr !== ""
    ? parseInt(parentIdStr, 10)
    : null;

  // Create comment
  await createComment({
    articleSlug,
    message: replyBody.trim(),
    alias,
    parentId,
  });

  // Redirect back to the article page
  return redirect(`/articles/${articleSlug}`, 303);
};
