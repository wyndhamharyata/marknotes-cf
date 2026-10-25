import type { APIRoute } from "astro";
import { type CollectionEntry, getCollection } from "astro:content";

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => data.coffeeId !== undefined);
  return posts.map((post) => ({ params: { coffeeId: post.data.coffeeId }, props: post }));
}

export const GET: APIRoute = ({ props, site }) => {
  const { id, data } = props as CollectionEntry<"blog">;
  return Response.json({
    slug: id,
    title: data.title,
    description: data.description,
    pubDate: data.pubDate,
    updatedDate: data.updatedDate,
    heroImage: data.heroImage && new URL(data.heroImage.src, site).href,
    url: new URL(`/articles/${id}`, site).href,
    embedUrl: new URL(`/embed/coffee/${data.coffeeId}`, site).href,
  });
};
