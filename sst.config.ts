/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "marknotes-cf",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: { cloudflare: "6.11.0" },
    };
  },
  async run() {
    const libsqlUrl = new sst.Secret("LibsqlUrl");
    const libsqlAuthToken = new sst.Secret("LibsqlAuthToken");
    const geminiApiKey = new sst.Secret("GeminiApiKey");
    const openAuthUrl = new sst.Secret("OpenAuthUrl");
    const baseUrl = new sst.Secret("BaseUrl");

    new sst.cloudflare.x.Astro("Max", {
      domain: $app.stage === "production" ? "read.mwyndham.dev" : "devread.mwyndham.dev",
      link: [libsqlUrl, libsqlAuthToken, geminiApiKey, openAuthUrl, baseUrl],
      environment: {
        LIBSQL_URL: libsqlUrl.value,
        LIBSQL_AUTH_TOKEN: libsqlAuthToken.value,
        GEMINI_API_KEY: geminiApiKey.value,
        OPEN_AUTH_URL: openAuthUrl.value,
        BASE_URL: baseUrl.value,
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
            },
          };
        },
      },
    });

    new sst.cloudflare.Cron("ModerationCron", {
      job: {
        handler: "src/workers/moderation-cron.ts",
        link: [libsqlUrl, libsqlAuthToken, geminiApiKey],
      },
      schedules: ["*/10 * * * *"],
    });
  },
});
