import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { client, setTokens } from "../lib/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get("code");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const [tokens, error] = await tryCatch(
    client.exchange(code, ctx.url.origin + "/callback"),
  );
  if (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify(error), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (tokens.err) {
    console.error("Token exchange error:", tokens.err);
    return new Response(JSON.stringify(tokens.err), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  setTokens(ctx, tokens.tokens.access, tokens.tokens.refresh);
  return ctx.redirect("/admin", 302);
};
