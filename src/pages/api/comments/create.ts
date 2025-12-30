import type { APIRoute } from "astro";
import { createComment } from "../../../lib/comments/repository";
import { getOrCreateAlias } from "../../../lib/comments/diceware";

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const articleSlug = formData.get("articleSlug") as string;
  const replyBody = formData.get("replyBody") as string;
  const parentIdStr = formData.get("parentId") as string;

  // Validation
  if (!replyBody?.trim()) {
    return new Response(
      JSON.stringify({ error: "Comment body cannot be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!articleSlug) {
    return new Response(
      JSON.stringify({ error: "Article slug is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get or create alias from cookie
  const alias = getOrCreateAlias(cookies);

  // Parse parentId
  const parentId = parentIdStr && parentIdStr !== "0" && parentIdStr !== ""
    ? parseInt(parentIdStr, 10)
    : null;

  // Create comment and get the new ID
  const newId = await createComment({
    articleSlug,
    message: replyBody.trim(),
    alias,
    parentId,
  });

  // Return the new comment as JSON
  return new Response(
    JSON.stringify({
      success: true,
      comment: {
        id: newId,
        message: replyBody.trim(),
        alias,
        parentId,
        articleSlug,
        createdAt: new Date().toISOString(),
        moderationStatus: 0, // New comments are unverified
        hidePublicity: false,
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
