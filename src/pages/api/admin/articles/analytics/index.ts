import type { APIRoute } from "astro";
import { getDoStub } from "../../../../../lib/db/do-client";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug") ?? "";
  if (slug === "") return new Response("Not found", { status: 404 });

  const analytics = await getDoStub().getLatestAnalyticsBySlug(slug);
  return new Response(JSON.stringify(analytics), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
