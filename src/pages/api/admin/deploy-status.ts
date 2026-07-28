import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { ghApi } from "../../../lib/github";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const sha = new URL(request.url).searchParams.get("sha");
  if (!sha) return new Response(JSON.stringify({ error: "sha is required" }), { status: 400 });

  const [resp, error] = await tryCatch(
    ghApi(`/actions/workflows/deploy.yml/runs?head_sha=${encodeURIComponent(sha)}&per_page=1`)
  );

  if (error) {
    console.error("Deploy status lookup failed: ", error);
    return new Response(JSON.stringify({ error: "Could not reach GitHub" }), { status: 502 });
  }

  const body = (await resp.json()) as {
    workflow_runs: { status: string; conclusion: string | null; html_url: string }[];
  };
  const run = body.workflow_runs[0];

  return new Response(
    JSON.stringify({
      // No run yet means GitHub has the push but has not created one; the
      // banner cannot tell that apart from `queued` anyway.
      status: run?.status ?? "pending",
      conclusion: run?.conclusion ?? null,
      htmlUrl: run?.html_url ?? null,
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
};
