import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async () => {
  const entries = await getCollection("blog");
  const slugs = entries.map((e) => ({ slug: e.id }));

  return new Response(JSON.stringify(slugs), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
};
