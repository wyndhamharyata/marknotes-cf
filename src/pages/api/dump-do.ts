import type { APIRoute } from "astro";
import { Resource } from "sst";
import { getDoStub } from "../../lib/db/do-client";

// Layered guards: stage 404s on prod, MigrationToken 403s, and prod binds no secret.
export const GET: APIRoute = async ({ url, locals }) => {
  const stage = (locals as unknown as { runtime?: { env?: { STAGE?: string } } })
    .runtime?.env?.STAGE;
  if (stage === "production") {
    return new Response("Not Found", { status: 404 });
  }

  let expectedToken = "";
  try {
    expectedToken = (Resource as unknown as { MigrationToken: { value: string } })
      .MigrationToken.value;
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const providedToken = url.searchParams.get("token");
  if (!expectedToken || providedToken !== expectedToken) {
    return new Response("Forbidden", { status: 403 });
  }

  const sql = await getDoStub().dumpSql();
  return new Response(sql, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
