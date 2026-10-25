/// <reference types="@cloudflare/workers-types" />
// Local `sst dev` entry: Astro handler + an in-process MainDO, so DB calls stay on this machine.
import handler from "@astrojs/cloudflare/entrypoints/server";
import { MainDO } from "./do/main-do";

export { MainDO };

export default {
  async fetch(request, env, ctx) {
    // scripts/db-pull.mjs POSTs prod rows here to replace local data.
    if (new URL(request.url).pathname === "/__seed" && request.method === "POST") {
      const stub = env.MAIN_DO.get(env.MAIN_DO.idFromName("main")) as any;
      await stub.seed(await request.json());
      return new Response("seeded");
    }
    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<{ MAIN_DO: DurableObjectNamespace<MainDO> }>;
