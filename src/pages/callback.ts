import type { APIRoute } from "astro";
import { client, setTokens } from "../lib/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get("code");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const tokens = await client.exchange(code, ctx.url.origin + "/callback");

    if (tokens.err) {
      console.error("Token exchange error:", tokens.err);
      return new Response(JSON.stringify(tokens.err), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    setTokens(ctx, tokens.tokens.access, tokens.tokens.refresh);
    return ctx.redirect("/admin", 302);
  } catch (e) {
    console.error("Callback error:", e);
    return new Response(JSON.stringify(e), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
