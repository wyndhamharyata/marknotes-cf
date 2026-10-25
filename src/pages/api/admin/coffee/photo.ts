import type { APIRoute } from "astro";

export const prerender = false;

// Kopimap's R2 domain sends no CORS headers, so the editor reads its photos through here.
export const GET: APIRoute = async ({ url }) => {
  const source = url.searchParams.get("url") ?? "";
  const host = URL.canParse(source) ? new URL(source).hostname : "";
  if (host !== "prod-kopimap.mwyndham.dev") {
    return Response.json({ error: "Only Kopimap photos can be imported" }, { status: 400 });
  }

  // Kopimap stores some URLs percent-encoded and some with raw spaces.
  const resp = await fetch(source.includes("%") ? source : encodeURI(source));
  if (!resp.ok) return Response.json({ error: `Kopimap returned ${resp.status}` }, { status: 502 });

  return new Response(resp.body, {
    headers: { "Content-Type": resp.headers.get("Content-Type") ?? "application/octet-stream" },
  });
};
