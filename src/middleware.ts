import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { defineMiddleware, sequence } from "astro:middleware";
import { env } from "cloudflare:workers";
import { client, subjects, setTokensFromCookies, isAdmin } from "./lib/auth";
import {
  getDoStubFromEnv,
  runtimeAls,
  type EnvWithMainDo,
  type StubLike,
} from "./lib/db/do-client";

const runtimeMiddleware = defineMiddleware(async (context, next) => {
  let stub: StubLike | null = null;
  if (env.MAIN_DO !== undefined) {
    stub = getDoStubFromEnv(env as EnvWithMainDo);
  }

  return runtimeAls.run({ env: (env as EnvWithMainDo) ?? {}, stub }, () => next());
});

const authMiddleware = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname === "/callback") {
    return next();
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return next();
  }

  const accessToken = context.cookies.get("access_token")?.value;
  const refreshToken = context.cookies.get("refresh_token")?.value;

  const [verified, verifyErr] = await tryCatch(
    client.verify(subjects, accessToken ?? "", { refresh: refreshToken ?? "" })
  );
  if (verifyErr) console.error("Auth verification failed:", verifyErr);

  if (verified && !verified.err) {
    if (verified.tokens) {
      setTokensFromCookies(context.cookies, verified.tokens.access, verified.tokens.refresh);
    }
    context.locals.user = verified.subject;

    if (!isAdmin(verified.subject)) {
      if (isAdminApi) {
        return new Response(
          JSON.stringify({ error: "Forbidden", message: "Admin access required" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return context.redirect("/", 302);
    }

    return next();
  }

  // Not authenticated
  if (isAdminApi) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { url } = await client.authorize(context.url.origin + "/callback", "code");

  if (context.request.headers.get("HX-Request") === "true") {
    return new Response(null, {
      status: 200,
      headers: { "HX-Redirect": url },
    });
  }

  return context.redirect(url, 302);
});

export const onRequest = sequence(runtimeMiddleware, authMiddleware);
