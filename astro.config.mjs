// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import { SHIKI_THEMES, printout } from "./src/lib/shiki-ink.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://mwyndham.dev",
  output: "server",
  redirects: {
    "/resume": "/articles/m-wyndham-haryata-permana-sr-full-stack-engineer/",
  },
  adapter: cloudflare({
    configPath: process.env.SST_WRANGLER_PATH ?? "./wrangler.local.jsonc",
    imageService: "cloudflare",
  }),
  compressHTML: true,
  markdown: {
    shikiConfig: { themes: SHIKI_THEMES, defaultColor: "light", transformers: [printout] },
  },
  image: {
    domains: ["resource.mwyndham.dev"],
  },
  integrations: [mdx(), sitemap(), preact()],
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "cloudflare-dev-optimizer",
        configEnvironment(environmentName) {
          if (["astro", "ssr", "prerender"].includes(environmentName)) {
            return {
              optimizeDeps: {
                ignoreOutdatedRequests: true,
                include: [
                  "astro/assets/services/noop",
                  "preact/devtools",
                  "@astrojs/preact/server.js",
                  "@openauthjs/openauth/client",
                  "@openauthjs/openauth/subject",
                  "valibot",
                  "sst",
                ],
                exclude: [
                  "astro/dist/core/render/route-cache",
                  "astro/dist/core/render/route-errors",
                ],
              },
            };
          }
        },
      },
    ],
  },
  env: {
    schema: {
      OPEN_AUTH_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      BASE_URL: envField.string({
        context: "server",
        access: "public", // needed for redirect URIs
        optional: true,
      }),
    },
  },
});
