import type { APIRoute } from "astro";
import { getCommentsForAdmin, getCommentCounts } from "../../../../lib/comments/admin-repository";
import { ModerationStatus, type ModerationStatusType } from "../../../../lib/comments/types";

export const GET: APIRoute = async ({ url }) => {
  const statusParam = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  let status: ModerationStatusType | null = null;
  if (statusParam !== null) {
    const statusNum = parseInt(statusParam, 10);
    if (
      statusNum in
      [
        ModerationStatus.UNVERIFIED,
        ModerationStatus.OK,
        ModerationStatus.WARNING,
        ModerationStatus.DANGEROUS,
      ]
    ) {
      status = statusNum as ModerationStatusType;
    }
  }

  const [commentsResult, counts] = await Promise.all([
    getCommentsForAdmin({ status, page, limit }),
    getCommentCounts(),
  ]);

  return new Response(
    JSON.stringify({
      comments: commentsResult.comments,
      total: commentsResult.total,
      counts,
      page,
      limit,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
