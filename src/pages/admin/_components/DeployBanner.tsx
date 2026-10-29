import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { useEffect, useState } from "preact/hooks";

// A commit reaches the site only once the workflow finishes, which takes minutes.
export default function DeployBanner() {
  const [sha, setSha] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("pending");
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [coffee, setCoffee] = useState(false);
  const [kopimap, setKopimap] = useState<"pending" | "updated" | "later">("pending");

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
    setCoffee(record.coffee === true);
  }, []);

  const fetchStatus = async () => {
    const resp = await fetch(`/api/admin/deploy-status?sha=${sha}`);
    if (!resp.ok) return null;
    return (await resp.json()) as {
      status: string;
      conclusion: string | null;
      htmlUrl: string | null;
    };
  };

  useEffect(() => {
    if (!sha) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const [body] = await tryCatch(fetchStatus());

      if (cancelled) return;
      if (body) {
        setStatus(body.status);
        setConclusion(body.conclusion);
        setRunUrl(body.htmlUrl);

        if (body.status === "completed") {
          if (body.conclusion === "success") {
            localStorage.removeItem("marknotes-deploy");
            // Kopimap rereads the review index on its own within 10 minutes; this makes it now.
            if (coffee) {
              const [resp] = await tryCatch(fetch("/api/admin/coffee/refresh", { method: "POST" }));
              const refreshed =
                resp?.ok && ((await resp.json()) as { refreshed: boolean }).refreshed;
              setKopimap(refreshed ? "updated" : "later");
            }
            timer = setTimeout(() => setDismissed(true), 6_000);
          }
          return;
        }
      }
      timer = setTimeout(poll, 10_000);
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sha, coffee]);

  if (!sha || dismissed) return null;

  const done = status === "completed";
  const failed = done && conclusion !== "success";
  const dismiss = () => {
    localStorage.removeItem("marknotes-deploy");
    setDismissed(true);
  };
  const runLink = runUrl && (
    <a href={runUrl} target="_blank" rel="noreferrer">
      View run
    </a>
  );

  if (failed) {
    return (
      <div class="deploy" role="status">
        <div class="err-band">
          <span>Deploy failed for {slug}</span>
          {runLink}
          <button type="button" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // The workflow only reports queued, running and done, so the blocks step through those.
  const lit = done ? 5 : status === "in_progress" ? 3 : 1;

  return (
    <div class="deploy" role="status">
      <div class="vfd">
        <span class="msg-txt">
          {!done && `Deploying ${slug}`}
          {done && `${slug} is live`}
          {done && coffee && kopimap === "updated" && " · Kopimap updated"}
          {done && coffee && kopimap === "later" && " · Kopimap updates within 10 minutes"}
        </span>
        <i class="vfd-leader" />
        <span class="blocks" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} class={i < lit ? "on" : undefined} />
          ))}
        </span>
        {runLink}
        <button type="button" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
