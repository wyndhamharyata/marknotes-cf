import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async ({ url, params }) => {
  const slug = params["slug"];
  const post = (await getCollection("blog", ({ id }) => id === slug))?.[0] ?? null;

  if (!post)
    return new Response(JSON.stringify({ message: "content not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  return new Response(JSON.stringify({ post: post }), {
    headers: { "Content-Type": "application/json" },
  });
};
