import { defineMiddleware } from "astro:middleware";
import { fromCloudflareEnv } from "sst";

export const onRequest = defineMiddleware((context, next) => {
  // Initialize SST resources from Cloudflare environment bindings
  // This must be called before any code accesses Resource.*
  if (context.locals.runtime?.env) {
    fromCloudflareEnv(context.locals.runtime.env);
  }

  return next();
});
