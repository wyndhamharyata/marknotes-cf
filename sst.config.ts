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
    // Turso database secrets
    const libsqlUrl = new sst.Secret("LibsqlUrl");
    const libsqlAuthToken = new sst.Secret("LibsqlAuthToken");

    new sst.cloudflare.x.Astro("Max", {
      domain:
        $app.stage === "production"
          ? "read.mwyndham.dev"
          : "devread.mwyndham.dev",
      link: [libsqlUrl, libsqlAuthToken],
      environment: {
        LIBSQL_URL: libsqlUrl.value,
        LIBSQL_AUTH_TOKEN: libsqlAuthToken.value
      },
      dev: false
    });
  },
});
