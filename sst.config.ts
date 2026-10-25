/// <reference path="./.sst/platform/config.d.ts" />
const PROD_BUCKET = "marknotes-cf-production-imagestagingbucketbucket-wotheafa";

export default $config({
  app(input) {
    return {
      name: "marknotes-cf",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: { cloudflare: "6.15.0" },
    };
  },
  async run() {
    const geminiApiKey = new sst.Secret("GeminiApiKey");
    const openAuthUrl = new sst.Secret("OpenAuthUrl");
    const baseUrl = new sst.Secret("BaseUrl");

    const cfAccountId = new sst.Secret("CfAccountId");
    const cfSiteTag = new sst.Secret("CfSiteTag");
    const cfAnalyticsToken = new sst.Secret("CfAnalyticsToken");
    const cfAnalyticsEmail = new sst.Secret("CfAnalyticsEmail");

    const migrationToken = new sst.Secret("MigrationToken");

    const githubToken = new sst.Secret("GithubToken");

    const r2AccessKeyId = new sst.Secret("R2AccessKeyId");
    const r2SecretAccessKey = new sst.Secret("R2SecretAccessKey");
    const r2CloudflareAPIToken = new sst.Secret("R2CloudflareAPIToken");

    // `sst dev` deploys nothing: it runs astro dev with prod secrets and a local DO (`npm run db:pull` copies prod data).
    if ($dev) {
      const secrets = {
        GeminiApiKey: geminiApiKey,
        OpenAuthUrl: openAuthUrl,
        BaseUrl: baseUrl,
        MigrationToken: migrationToken,
        GithubToken: githubToken,
        R2AccessKeyId: r2AccessKeyId,
        R2SecretAccessKey: r2SecretAccessKey,
        R2CloudflareAPIToken: r2CloudflareAPIToken,
        CfAccountId: cfAccountId,
      };
      const fs = await import("fs");
      const wranglerPath = `${process.cwd()}/.dev/wrangler.jsonc`;
      const environment = $resolve(
        Object.fromEntries(Object.entries(secrets).map(([k, s]) => [k, s.value]))
      ).apply((v: Record<string, string>) => {
        const vars: Record<string, string> = {
          STAGE: "production",
          GEMINI_API_KEY: v.GeminiApiKey,
          OPEN_AUTH_URL: v.OpenAuthUrl,
          BASE_URL: v.BaseUrl,
          R2_BUCKET_NAME: PROD_BUCKET,
          GITHUB_TOKEN: v.GithubToken,
          R2_ACCESS_KEY_ID: v.R2AccessKeyId,
          R2_SECRET_ACCESS_KEY: v.R2SecretAccessKey,
          R2_CLOUDFLARE_API_TOKEN: v.R2CloudflareAPIToken,
          CF_ACCOUNT_ID: v.CfAccountId,
          SST_RESOURCE_App: JSON.stringify({ name: $app.name, stage: $app.stage }),
        };
        for (const [k, value] of Object.entries(v)) {
          vars[`SST_RESOURCE_${k}`] = JSON.stringify({ type: "sst.sst.Secret", value });
        }
        fs.mkdirSync(".dev", { recursive: true });
        fs.writeFileSync(
          wranglerPath,
          JSON.stringify(
            {
              name: "marknotes-cf",
              compatibility_date: "2026-08-11",
              compatibility_flags: ["nodejs_compat", "disable_nodejs_process_v2"],
              main: `${process.cwd()}/src/dev-worker.ts`,
              vars,
              // All local: remote bindings add a slow remote session + a round trip per call.
              durable_objects: { bindings: [{ name: "MAIN_DO", class_name: "MainDO" }] },
              migrations: [{ tag: "v1", new_sqlite_classes: ["MainDO"] }],
              r2_buckets: [{ binding: "ImageStagingBucket", bucket_name: PROD_BUCKET }],
            },
            null,
            2
          )
        );
        return vars;
      });
      new sst.x.DevCommand("LocalDev", {
        dev: { command: "npm run dev" },
        environment: environment.apply((vars) => ({ ...vars, SST_WRANGLER_PATH: wranglerPath })),
      });
      return;
    }

    const imageStagingBucket = new sst.cloudflare.Bucket("ImageStagingBucket");
    // Gate the newSqliteClasses migration on INIT_DO=1 — CF rejects re-sends.
    // First deploy per stage: `INIT_DO=1 sst deploy --stage <stage>`.
    const initDo = process.env.INIT_DO === "1";
    const mainDoHost = new sst.cloudflare.Worker("MainDOHost", {
      handler: "src/do/host.ts",
      build: {
        loader: {
          ".sql": "text",
        },
      },
      transform: {
        worker(args) {
          if (initDo) {
            args.migrations = {
              newSqliteClasses: ["MainDO"],
              newTag: "v1",
            };
          }
        },
      },
    });

    const mainDoScriptName = mainDoHost.nodes.worker.scriptName;

    function appendMainDoBinding(args: { bindings?: any; compatibilityFlags?: any }) {
      args.bindings = $resolve([args.bindings, mainDoScriptName]).apply(
        ([existing, scriptName]) => [
          ...((existing as any[]) ?? []),
          {
            type: "durable_object_namespace",
            name: "MAIN_DO",
            className: "MainDO",
            scriptName,
          },
        ]
      );
      args.compatibilityFlags = $resolve([args.compatibilityFlags]).apply(([flags]) => {
        const list = (flags as string[]) ?? [];
        return list.includes("nodejs_compat") ? list : [...list, "nodejs_compat"];
      });
    }

    new sst.cloudflare.Astro("Max", {
      domain: $app.stage === "production" ? "mwyndham.dev" : "devread.mwyndham.dev",
      link: [
        geminiApiKey,
        openAuthUrl,
        baseUrl,
        migrationToken,
        githubToken,
        r2AccessKeyId,
        r2SecretAccessKey,
        r2CloudflareAPIToken,
        imageStagingBucket,
        cfAccountId,
      ],
      environment: {
        STAGE: $app.stage,
        GEMINI_API_KEY: geminiApiKey.value,
        OPEN_AUTH_URL: openAuthUrl.value,
        BASE_URL: baseUrl.value,
        R2_BUCKET_NAME: imageStagingBucket.name,
        GITHUB_TOKEN: githubToken.value,
        R2_ACCESS_KEY_ID: r2AccessKeyId.value,
        R2_SECRET_ACCESS_KEY: r2SecretAccessKey.value,
        R2_CLOUDFLARE_API_TOKEN: r2CloudflareAPIToken.value,
        CF_ACCOUNT_ID: cfAccountId.value,
      },
      dev: false,
      transform: {
        server(args, _opts, _name) {
          args.transform = {
            ...args.transform,
            worker(args, _opts, _name) {
              args.observability = {
                enabled: false,
                headSamplingRate: 1,
                logs: {
                  enabled: true,
                  headSamplingRate: 1,
                  persist: true,
                  invocationLogs: true,
                },
              };
              appendMainDoBinding(args);
            },
          };
        },
      },
    });

    new sst.cloudflare.Cron("ModerationCron", {
      worker: {
        handler: "src/workers/moderation-cron.ts",
        link: [geminiApiKey],
        transform: {
          worker(args) {
            appendMainDoBinding(args);
          },
        },
      },
      schedules: ["*/10 * * * *"],
    });

    new sst.cloudflare.Cron("AnalyticsCron", {
      worker: {
        handler: "src/workers/analytics-cron.ts",
        link: [cfAccountId, cfSiteTag, cfAnalyticsToken, cfAnalyticsEmail, baseUrl],
        transform: {
          worker(args) {
            appendMainDoBinding(args);
          },
        },
      },
      schedules: ["0 */3 * * *"],
    });
  },
});
