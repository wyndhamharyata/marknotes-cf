import { useEffect, useState } from "preact/hooks";

// A commit reaches the site only once the workflow finishes, which takes minutes.
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
            if (body.conclusion === "success") {
              localStorage.removeItem("marknotes-deploy");
              timer = setTimeout(() => setDismissed(true), 6_000);
            }
            return;
          }
        }
      } catch {
        // Offline or a transient 502; the next tick retries.
      }
      // An install plus an SST deploy takes minutes; faster polling only spends rate limit.
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

  const tone = failed
    ? "border-error-content/25 bg-error/95 text-error-content"
    : done
      ? "border-success-content/25 bg-success/95 text-success-content"
      : "border-info-content/25 bg-info/95 text-info-content";

  return (
    <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        class={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm font-medium shadow-2xl backdrop-blur-xl backdrop-saturate-150 ${tone}`}
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
          class="btn btn-ghost btn-xs shrink-0 [--btn-fg:currentColor]"
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
