import type { APIRoute } from "astro";

export const prerender = false;

// Asks Kopimap to reread /api/coffee-reviews.json now, instead of within 10 minutes.
export const POST: APIRoute = async () => {
  const resp = await fetch("https://kopimap.mwyndham.dev/api/coffees/reviews/refresh", {
    method: "POST",
  }).catch(() => null);
  return Response.json({ refreshed: resp?.ok ?? false });
};
