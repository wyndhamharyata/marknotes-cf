/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
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
