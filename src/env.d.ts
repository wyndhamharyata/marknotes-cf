/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    MAIN_DO?: DurableObjectNamespace<import("./do/main-do").MainDO>;
    STAGE?: string;
  }
}

declare namespace App {
  interface Locals {
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
