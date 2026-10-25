import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

// Kopimap derives each shop's "reviewed" state and rating from this file, so it changes only on deploy.
export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection("blog", ({ data }) => data.coffeeId !== undefined);
  return Response.json(
    posts.map(({ id, data }) => ({
      coffeeId: data.coffeeId,
      slug: id,
      title: data.title,
      rating: data.rating ?? 0,
      pubDate: data.pubDate,
      url: new URL(`/articles/${id}`, site).href,
    }))
  );
};
