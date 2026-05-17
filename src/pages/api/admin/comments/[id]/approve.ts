import type { APIRoute } from "astro";
import { getDoStub } from "../../../../../lib/db/do-client";

export const POST: APIRoute = async ({ params, redirect }) => {
  const id = parseInt(params.id || "", 10);

  if (isNaN(id)) {
    return new Response("Invalid comment ID", { status: 400 });
  }

  await getDoStub().markCommentSafe(id);

  // Redirect back to refresh the list
  return redirect("/admin/comments");
};
