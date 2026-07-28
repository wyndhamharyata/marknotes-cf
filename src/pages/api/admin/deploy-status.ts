import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { APIRoute } from "astro";
import { deployRunForSha } from "../../../lib/github";

export const prerender = false;

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * Progress of the deploy workflow for one commit.
 *
 * `pending` covers the window between the push and GitHub creating the run,
 * which the banner cannot tell apart from `queued` anyway.
 */
export const GET: APIRoute = async ({ request }) => {
  const sha = new URL(request.url).searchParams.get("sha");
  if (!sha || !SHA.test(sha)) return json({ error: "Invalid sha" }, 400);

  const [run, error] = await tryCatch(deployRunForSha(sha));
  if (error) {
    console.error("Deploy status lookup failed: ", error);
    return json({ error: "Could not reach GitHub" }, 502);
  }

  return json({
    status: run?.status ?? "pending",
    conclusion: run?.conclusion ?? null,
    htmlUrl: run?.htmlUrl ?? null,
  });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
