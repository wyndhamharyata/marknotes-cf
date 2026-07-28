import { useEffect, useState } from "preact/hooks";
import {
  clearTrackedDeploy,
  readTrackedDeploy,
  type TrackedDeploy,
} from "../../../lib/deploy-tracker";

interface DeployState {
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
}

// The workflow installs dependencies and runs an SST deploy, so a couple of
// minutes is normal; polling faster would only spend rate limit.
const POLL_MS = 10_000;

/**
 * Follows the deploy the last publish kicked off.
 *
 * A commit only reaches the site once the workflow finishes, so without this
 * the editor's redirect looks like nothing happened for two minutes.
 */
export default function DeployBanner() {
  const [tracked, setTracked] = useState<TrackedDeploy | null>(null);
  const [state, setState] = useState<DeployState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // localStorage is not available while the layout renders on the server.
  useEffect(() => setTracked(readTrackedDeploy()), []);

  useEffect(() => {
    if (!tracked) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const resp = await fetch(`/api/admin/deploy-status?sha=${tracked.sha}`);
        const body = (await resp.json()) as DeployState;

        if (cancelled) return;
        if (resp.ok) {
          setState(body);
          if (body.status === "completed") {
            // Kept on failure so a broken deploy still follows you around.
            if (body.conclusion === "success") clearTrackedDeploy();
            return;
          }
        }
      } catch {
        // Offline or a transient 502; the next tick retries.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tracked]);

  if (!tracked || dismissed) return null;

  const done = state?.status === "completed";
  const failed = done && state?.conclusion !== "success";

  const dismiss = () => {
    clearTrackedDeploy();
    setDismissed(true);
  };

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
          {!done && <>Deploying {tracked.slug}…</>}
          {done && !failed && <>{tracked.slug} is live</>}
          {failed && <>Deploy failed for {tracked.slug}</>}
        </span>

        {state?.htmlUrl && (
          <a href={state.htmlUrl} target="_blank" rel="noreferrer" class="link shrink-0">
            View run
          </a>
        )}
        <button type="button" class="btn btn-ghost btn-xs shrink-0" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
