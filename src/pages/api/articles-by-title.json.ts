
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const title = url.searchParams.get("title");
  const post = (await getCollection("blog", ({ data }) => data.title === title))?.[0] ?? null;

  if (!post)
    return new Response(JSON.stringify({ message: "content not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  return new Response(JSON.stringify({ post: post }), {
    headers: { "Content-Type": "application/json" },
  });
};
