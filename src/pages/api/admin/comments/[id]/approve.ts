import type { APIRoute } from "astro";
import { markCommentSafe } from "../../../../../lib/comments/admin-repository";

export const POST: APIRoute = async ({ params, redirect }) => {
  const id = parseInt(params.id || "", 10);

  if (isNaN(id)) {
    return new Response("Invalid comment ID", { status: 400 });
  }

  await markCommentSafe(id);

  // Redirect back to refresh the list
  return redirect("/admin/comments");
};
