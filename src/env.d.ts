/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  // SST injects linked secrets as environment bindings
  SST_RESOURCE_LibsqlUrl?: string;
  SST_RESOURCE_LibsqlAuthToken?: string;
  MAIN_DO: DurableObjectNamespace<import("./do/main-do").MainDO>;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    user?: {
      type: "user";
      properties: {
        userID: string;
        email: string;
        oauthID?: string;
      };
    };
  }
}
