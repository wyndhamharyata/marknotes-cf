import type { APIRoute } from "astro";
import { createCommentWithModeration } from "../../../lib/comments/repository";
import { getOrCreateAlias } from "../../../lib/comments/diceware";
import { ModerationStatus } from "../../../lib/comments/types";
import { hasProfanity } from "../../../lib/moderation/profanity-filter";

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const articleSlug = formData.get("articleSlug") as string;
  const replyBody = formData.get("replyBody") as string;
  const parentIdStr = formData.get("parentId") as string;

  const assertionErr = assertValidRequest(replyBody, articleSlug);
  if (!!assertionErr) {
    return assertionErr;
  }

  const alias = getOrCreateAlias(cookies);

  const parentId =
    parentIdStr && parentIdStr !== "0" && parentIdStr !== "" ? parseInt(parentIdStr, 10) : null;

  const trimmedMessage = replyBody.trim();

  // Profanity is now rejected in assertValidRequest, so all comments reaching here are clean
  const moderationStatus = ModerationStatus.UNVERIFIED;

  const newId = await createCommentWithModeration(
    {
      articleSlug,
      message: trimmedMessage,
      alias,
      parentId,
    },
    moderationStatus
  );

  return new Response(
    JSON.stringify({
      success: true,
      comment: {
        id: newId,
        message: trimmedMessage,
        alias,
        parentId,
        articleSlug,
        createdAt: new Date().toISOString(),
        moderationStatus,
        hidePublicity: false,
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};

const assertValidRequest = (replyBody: string, articleSlug: string) => {
  let err: string | null = null;

  if (!replyBody?.trim()) {
    err = "Comment body cannot be empty";
  }

  if (!articleSlug) {
    err = "Article slug is required";
  }

  if (!err && hasProfanity(replyBody.trim())) {
    err = "Your comment contains inappropriate language. Please revise and try again.";
  }

  if (!!err && err.trim() !== "") {
    return new Response(JSON.stringify({ error: err }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
