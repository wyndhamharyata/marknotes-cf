import { useEffect, useState } from "preact/hooks";

/**
 * Follows the deploy the last publish kicked off.
 *
 * A commit only reaches the site once the workflow finishes, so without this the
 * editor's redirect looks like nothing happened for two minutes.
 */
export default function DeployBanner() {
  const [sha, setSha] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("pending");
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // localStorage is not readable while the layout renders on the server.
  useEffect(() => {
    const raw = localStorage.getItem("marknotes-deploy");
    if (!raw) return;

    const record = JSON.parse(raw);
    // The workflow times out at 10 minutes, so past this it is stale, not pending.
    if (Date.now() - record.startedAt > 20 * 60 * 1000) {
      localStorage.removeItem("marknotes-deploy");
      return;
    }
    setSha(record.sha);
    setSlug(record.slug);
  }, []);

  useEffect(() => {
    if (!sha) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const resp = await fetch(`/api/admin/deploy-status?sha=${sha}`);
        const body = (await resp.json()) as {
          status: string;
          conclusion: string | null;
          htmlUrl: string | null;
        };

        if (cancelled) return;
        if (resp.ok) {
          setStatus(body.status);
          setConclusion(body.conclusion);
          setRunUrl(body.htmlUrl);

          if (body.status === "completed") {
            // Kept on failure, so a broken deploy still follows you around.
            if (body.conclusion === "success") localStorage.removeItem("marknotes-deploy");
            return;
          }
        }
      } catch {
        // Offline or a transient 502; the next tick retries.
      }
      // A dependency install plus an SST deploy takes minutes; polling faster
      // would only spend rate limit.
      if (!cancelled) timer = setTimeout(poll, 10_000);
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sha]);

  if (!sha || dismissed) return null;

  const done = status === "completed";
  const failed = done && conclusion !== "success";

  return (
    <div class="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 md:bottom-24">
      <div
        class={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm shadow-2xl backdrop-blur-xl backdrop-saturate-150 ${
          failed
            ? "border-error/40 bg-error/90 text-error-content"
            : "border-base-content/10 bg-base-100/90 supports-[backdrop-filter]:bg-base-100/75"
        }`}
      >
        {!done && <span class="loading loading-spinner loading-xs" />}
        <span class="min-w-0">
          {!done && `Deploying ${slug}…`}
          {done && !failed && `${slug} is live`}
          {failed && `Deploy failed for ${slug}`}
        </span>

        {runUrl && (
          <a href={runUrl} target="_blank" rel="noreferrer" class="link shrink-0">
            View run
          </a>
        )}
        <button
          type="button"
          class="btn btn-ghost btn-xs shrink-0"
          onClick={() => {
            localStorage.removeItem("marknotes-deploy");
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
