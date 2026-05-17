// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://blog.mwyndham.dev",
  output: "server",
  redirects: {
    "/resume": "/articles/m-wyndham-haryata-permana-sr-full-stack-engineer/",
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "cloudflare",
  }),
  image: {
    domains: ["resource.mwyndham.dev"],
  },
  integrations: [mdx(), sitemap(), preact(), icon()],
  vite: {
    plugins: [tailwindcss()],
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
