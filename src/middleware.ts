import { defineMiddleware, sequence } from "astro:middleware";
import { fromCloudflareEnv } from "sst";
import { client, subjects, setTokensFromCookies, isAdmin } from "./lib/auth";

const sstMiddleware = defineMiddleware((context, next) => {
  if (context.locals.runtime?.env) {
    fromCloudflareEnv(context.locals.runtime.env);
  }
  return next();
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

  try {
    const verified = await client.verify(subjects, accessToken ?? "", {
      refresh: refreshToken ?? "",
    });

    if (!verified.err) {
      if (verified.tokens) {
        setTokensFromCookies(
          context.cookies,
          verified.tokens.access,
          verified.tokens.refresh,
        );
      }
      context.locals.user = verified.subject;

      // Check if user is admin
      if (!isAdmin(verified.subject)) {
        if (isAdminApi) {
          return new Response(
            JSON.stringify({ error: "Forbidden", message: "Admin access required" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
        return context.redirect("/", 302);
      }

      return next();
    }
  } catch (e) {
    console.error("Auth verification failed:", e);
  }

  // Not authenticated
  if (isAdminApi) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { url } = await client.authorize(
    context.url.origin + "/callback",
    "code",
  );
  return context.redirect(url, 302);
});

export const onRequest = sequence(sstMiddleware, authMiddleware);
