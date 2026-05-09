import type { APIRoute } from "astro";
import { getLatestAnalyticsBySlug } from "../../../../../lib/analytics/repository";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug") ?? "";
  if (slug === "") return new Response("Not found", { status: 404 });

  const analytics = await getLatestAnalyticsBySlug(slug);
  return new Response(JSON.stringify(analytics), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
