/// <reference types="@cloudflare/workers-types" />

export { MainDO } from "./main-do";

export default {
  async fetch(): Promise<Response> {
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler;
