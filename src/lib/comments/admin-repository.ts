import { getDoStub } from "../db/do-client";
import type { ModerationStatusType, AdminComment, CommentCounts } from "./types";

interface GetCommentsOptions {
  status?: ModerationStatusType | null;
  page?: number;
  limit?: number;
}

interface GetCommentsResult {
  comments: AdminComment[];
  total: number;
}

export async function getCommentsForAdmin(
  options: GetCommentsOptions = {},
): Promise<GetCommentsResult> {
  const { status = null, page = 1, limit = 10 } = options;
  return getDoStub().getCommentsForAdmin({ status, page, limit });
}

export async function getCommentCounts(): Promise<CommentCounts> {
  return getDoStub().getCommentCounts();
}

export async function markCommentSafe(id: number): Promise<void> {
  return getDoStub().markCommentSafe(id);
}

export async function hideComment(id: number): Promise<void> {
  return getDoStub().hideComment(id);
}
