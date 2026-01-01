import { defineMiddleware, sequence } from "astro:middleware";
import { fromCloudflareEnv } from "sst";
import { client, subjects, setTokensFromCookies } from "./lib/auth";

const sstMiddleware = defineMiddleware((context, next) => {
  if (context.locals.runtime?.env) {
    fromCloudflareEnv(context.locals.runtime.env);
  }
  return next();
});

const authMiddleware = defineMiddleware(async (context, next) => {
  if (context.url.pathname === "/callback") {
    return next();
  }

  if (!context.url.pathname.startsWith("/admin")) {
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
      return next();
    }
  } catch (e) {
    console.error("Auth verification failed:", e);
  }

  const { url } = await client.authorize(
    context.url.origin + "/callback",
    "code",
  );
  return context.redirect(url, 302);
});

export const onRequest = sequence(sstMiddleware, authMiddleware);
