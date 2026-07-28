# marknotes-cf

Personal blog at [mwyndham.dev](https://mwyndham.dev) (staging: [devread.mwyndham.dev](https://devread.mwyndham.dev)). Astro 5 on Cloudflare Workers, deployed with SST. Articles are MDX files committed to this repo; comments and analytics live in a single Durable Object running SQLite.

## Stack

- **Astro 5** with the Cloudflare adapter, **Preact** islands, **Tailwind v4 + daisyUI 5**
- **SST 4** (`sst.config.ts`) provisioning everything on Cloudflare: the Astro site, a Durable Object host worker, two cron workers, and an R2 bucket
- **Drizzle** on Durable Object SQLite in production, **better-sqlite3** locally
- **OpenAuth** for admin login, **Gemini** for comment moderation, **Shiki** for syntax highlighting

## How it works

- `src/content/blog/` holds the articles. Publishing from the admin editor commits MDX and images to this repo through the GitHub API; a push touching content paths triggers the Deploy workflow, which runs `sst deploy --stage production`. The editor then polls `/api/admin/deploy-status` and shows a banner until the run finishes.
- `src/do/` is `MainDO`, the single Durable Object owning all mutable state (comments, moderation status, analytics snapshots) via Drizzle on its embedded SQLite.
- `src/workers/moderation-cron.ts` runs every 10 minutes and sends unmoderated comments to Gemini. `src/workers/analytics-cron.ts` runs every 3 hours and snapshots Cloudflare Web Analytics into the DO.
- `src/pages/admin/` is the admin panel: dashboard, MDX editor with live preview and image upload (staged in R2, compressed client-side to WebP), comment moderation, and per-article analytics charts (uPlot).
- `src/middleware.ts` gates `/admin` and `/api/admin` behind OpenAuth token verification.

## Local development

```sh
npm install
npm run dev
```

Miniflare can't host the Durable Object through `platformProxy`, so dev runs the same Drizzle queries against better-sqlite3 at `.dev/local.sqlite` (`src/lib/db/dev-fallback.ts`). On a fresh database, set `MIGRATION_TOKEN` in `.env` to auto-seed from staging via `/api/dump-do`.

## Commands

| Command                | Action                                                 |
| :--------------------- | :----------------------------------------------------- |
| `npm run dev`          | Dev server at `localhost:4321` with the SQLite fallback |
| `npm run build`        | Production build to `./dist/`                          |
| `npm run preview`      | Preview the build locally                              |
| `npm run astro check`  | Type-check `.astro` and `.ts` files                    |
| `npm run format`       | Prettier over the repo                                 |
| `npm run db:generate`  | Generate Drizzle migrations for the DO schema          |
| `npm run r2:cors`      | Apply `r2-cors.json` to the image staging bucket       |

## Deploying

Production deploys run from GitHub Actions (`.github/workflows/deploy.yml`) on pushes to `main` that touch `src/content/blog/**`, `src/content.config.ts`, or `package.json` — or manually via `workflow_dispatch`. To deploy by hand:

```sh
npx sst deploy --stage production
```

The first deploy of any stage must ship the DO SQLite migration, which Cloudflare rejects if re-sent:

```sh
INIT_DO=1 npx sst deploy --stage <stage>
```

Secrets are managed with `npx sst secret set <Name> --stage <stage>`: `GeminiApiKey`, `OpenAuthUrl`, `BaseUrl`, `MigrationToken`, `GithubToken`, `CfAccountId`, `CfSiteTag`, `CfAnalyticsToken`, `CfAnalyticsEmail`, `R2AccessKeyId`, `R2SecretAccessKey`, `R2CloudflareAPIToken`.

## Credit

The theme started from Astro's blog template, itself based on [Bear Blog](https://github.com/HermanMartinus/bearblog/).
