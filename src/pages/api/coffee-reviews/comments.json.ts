import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getDoStub } from "../../../lib/db/do-client";

export const prerender = false;

// Approved, public comments per coffeeId, for Kopimap's list counts and card.
export const GET: APIRoute = async () => {
  const posts = await getCollection("blog", ({ data }) => data.coffeeId !== undefined);
  const comments = await getDoStub().getPublicCommentsBySlugs(posts.map((post) => post.id));

  const byCoffee = Object.fromEntries(
    posts.map(({ id, data }) => {
      const own = comments.filter((comment) => comment.articleSlug === id);
      return [
        data.coffeeId,
        {
          count: own.length,
          latest: own.slice(0, 2).map(({ id, alias, message, createdAt, parentId }) => ({
            id,
            alias,
            message,
            createdAt,
            parentId,
          })),
        },
      ];
    })
  );

  return Response.json(byCoffee, { headers: { "Cache-Control": "public, s-maxage=300" } });
};
