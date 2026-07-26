import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { isSafeSlug } from "../../../../../lib/asset-key";
import {
  clearDraft,
  loadDraft,
  requestPersistentStorage,
  saveDraft,
} from "../../../../../lib/editor/draft-store";
import {
  assetIdFromKey,
  formatPubDate,
  inlineImageSnippet,
  referencedInlineKeys,
  serializeMdx,
} from "../../../../../lib/editor/mdx-serialize";
import { slugifyTitle } from "../../../../../lib/editor/slugify";
import { insertAtCursor, replaceInTextarea } from "../../../../../lib/editor/textarea";
import { emptyDraft, type ArticleDraft } from "../../../../../lib/editor/types";
import { uploadAsset } from "../../../../../lib/editor/upload";
import EditorPane from "./EditorPane";
import HeroImagePicker from "./HeroImagePicker";
import MetaFields from "./MetaFields";
import PreviewPane from "./PreviewPane";

interface Props {
  /** Server-rendered from the content collection, for collision warnings. */
  existingSlugs: string[];
  proseClass: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "error"; message: string };

const AUTOSAVE_DEBOUNCE_MS = 500;
const MIN_PANE_RATIO = 0.25;
const MAX_PANE_RATIO = 0.75;

export default function MdxEditor({ existingSlugs, proseClass }: Props) {
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pendingUploads, setPendingUploads] = useState(0);
  const [ratio, setRatio] = useState(0.5);
  const [isWide, setIsWide] = useState(false);

  const splitRef = useRef<HTMLDivElement>(null);

  // Restore before first paint of the real UI, so the fields never flash empty
  // and then fill in.
  useEffect(() => {
    let cancelled = false;

    loadDraft().then((stored) => {
      if (cancelled) return;
      setDraft(stored ?? emptyDraft(formatPubDate(new Date())));
      if (stored?.slug) setSlugTouched(true);
    });

    requestPersistentStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void saveDraft(draft), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Autosave covers navigation, but an in-flight upload really would be lost.
  useEffect(() => {
    if (pendingUploads === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingUploads]);

  const update = useCallback((patch: Partial<ArticleDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const onTitle = useCallback(
    (title: string) => {
      setDraft((current) => {
        if (!current) return current;
        return { ...current, title, slug: slugTouched ? current.slug : slugifyTitle(title) };
      });
    },
    [slugTouched]
  );

  const slugError = useMemo(() => {
    if (!draft?.slug) return null;
    if (!isSafeSlug(draft.slug)) return "Lowercase letters, numbers and hyphens only.";
    if (existingSlugs.includes(draft.slug)) return "An article with this slug already exists.";
    return null;
  }, [draft?.slug, existingSlugs]);

  /**
   * GitHub's upload behaviour: drop a placeholder at the caret immediately, then
   * swap it for the real component when the upload lands. Writing continues
   * uninterrupted, and a failure leaves a visible marker rather than silence.
   */
  const onImages = useCallback(
    async (files: File[], textarea: HTMLTextAreaElement) => {
      const slug = draft?.slug || slugifyTitle(draft?.title ?? "");
      if (!slug) {
        setStatus({
          kind: "error",
          message: "Add a title first — the slug decides where images are stored.",
        });
        return;
      }

      // Every placeholder goes in before any upload starts, so dropping five
      // images marks all five spots at once instead of trickling them in as
      // each request completes.
      const jobs = files.map((file) => {
        const token = crypto.randomUUID().slice(0, 8);
        const placeholder = `![Uploading ${file.name}…](uploading:${token})`;
        insertAtCursor(textarea, `\n${placeholder}\n`);
        return { file, placeholder };
      });

      setPendingUploads((count) => count + jobs.length);

      /**
       * Prefer editing the textarea directly: an upload usually lands while the
       * author is still typing, and routing the swap through state would reset
       * `value`, throwing the caret to the end of the document. Only fall back
       * to state when the textarea isn't focused, where the caret is moot.
       */
      const swap = (placeholder: string, replacement: string) => {
        if (document.activeElement === textarea) {
          if (replaceInTextarea(textarea, placeholder, replacement)) return;
        }
        setDraft((current) =>
          current ? { ...current, body: current.body.replace(placeholder, replacement) } : current
        );
      };

      await Promise.all(
        jobs.map(async ({ file, placeholder }) => {
          try {
            const { key } = await uploadAsset(file, slug, "content");
            const asset = {
              id: assetIdFromKey(key),
              r2Key: key,
              alt: file.name.replace(/\.[^.]+$/, ""),
            };

            setDraft((current) =>
              current ? { ...current, inlineAssets: [...current.inlineAssets, asset] } : current
            );
            swap(placeholder, inlineImageSnippet(asset));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            swap(placeholder, `_Upload failed: ${file.name}_`);
            setStatus({ kind: "error", message: `${file.name}: ${message}` });
          } finally {
            setPendingUploads((count) => count - 1);
          }
        })
      );
    },
    [draft?.slug, draft?.title]
  );

  const publish = useCallback(async () => {
    if (!draft) return;

    if (!draft.title.trim() || !draft.description.trim() || !draft.slug.trim()) {
      setStatus({ kind: "error", message: "Title, description and slug are all required." });
      return;
    }
    // Frontmatter alone would satisfy the endpoint's non-empty `content` check,
    // so an empty article has to be caught here.
    if (!draft.body.trim()) {
      setStatus({ kind: "error", message: "The article body is empty." });
      return;
    }
    if (slugError) {
      setStatus({ kind: "error", message: slugError });
      return;
    }

    try {
      let ready = draft;

      if (draft.heroFile && !draft.heroKey) {
        setStatus({ kind: "busy", message: "Uploading hero image…" });
        const { key } = await uploadAsset(draft.heroFile, draft.slug, "hero");
        ready = { ...draft, heroKey: key };
        setDraft(ready);
      }

      setStatus({ kind: "busy", message: "Committing to GitHub…" });
      const response = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: ready.slug,
          content: serializeMdx(ready),
          imageKey: ready.heroKey,
          inlineImageKeys: referencedInlineKeys(ready),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) throw new Error(payload?.error ?? `Save failed (${response.status})`);

      await clearDraft();
      window.location.href = "/admin/articles";
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Save failed",
      });
    }
  }, [draft, slugError]);

  const startResize = useCallback((event: PointerEvent) => {
    const container = splitRef.current;
    if (!container) return;

    event.preventDefault();
    const bounds = container.getBoundingClientRect();

    const move = (moveEvent: PointerEvent) => {
      const next = (moveEvent.clientX - bounds.left) / bounds.width;
      setRatio(Math.min(MAX_PANE_RATIO, Math.max(MIN_PANE_RATIO, next)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, []);

  if (!draft) {
    return (
      <div class="space-y-4 p-4">
        <div class="skeleton h-12 w-full" />
        <div class="skeleton h-24 w-full" />
        <div class="skeleton h-[60vh] w-full" />
      </div>
    );
  }

  const busy = status.kind === "busy";
  const paneStyle = (share: number) => (isWide ? { width: `${share * 100}%` } : undefined);

  return (
    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-2xl font-bold">New article</h1>
        <div class="flex items-center gap-2">
          {pendingUploads > 0 && (
            <span class="badge badge-neutral gap-2">
              <span class="loading loading-spinner loading-xs" />
              {pendingUploads} uploading
            </span>
          )}
          <a href="/admin/articles" class="btn btn-ghost btn-sm">
            Cancel
          </a>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            disabled={busy || pendingUploads > 0}
            onClick={publish}
          >
            {busy && <span class="loading loading-spinner loading-xs" />}
            Publish
          </button>
        </div>
      </div>

      {status.kind === "error" && (
        <div class="alert alert-error">
          <span>{status.message}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            onClick={() => setStatus({ kind: "idle" })}
          >
            Dismiss
          </button>
        </div>
      )}
      {busy && (
        <div class="alert alert-info">
          <span>{status.message}</span>
        </div>
      )}

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-4">
          <MetaFields
            title={draft.title}
            slug={draft.slug}
            description={draft.description}
            pubDate={draft.pubDate}
            slugError={slugError}
            onTitle={onTitle}
            onSlug={(slug) => {
              setSlugTouched(true);
              update({ slug });
            }}
            onDescription={(description) => update({ description })}
            onPubDate={(pubDate) => update({ pubDate })}
          />
          <HeroImagePicker
            file={draft.heroFile}
            uploadedKey={draft.heroKey}
            onSelect={(heroFile) => update({ heroFile, heroKey: undefined })}
          />
        </div>
      </div>

      <div role="tablist" class="tabs tabs-box self-start md:hidden">
        <button
          type="button"
          role="tab"
          class={`tab ${view === "write" ? "tab-active" : ""}`}
          onClick={() => setView("write")}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          class={`tab ${view === "preview" ? "tab-active" : ""}`}
          onClick={() => setView("preview")}
        >
          Preview
        </button>
      </div>

      {/* A bounded height is what lets the two panes scroll independently;
          without it `overflow-y-auto` never engages and they grow forever. */}
      <div
        ref={splitRef}
        class="card bg-base-100 flex flex-col overflow-hidden shadow-sm md:h-[70vh] md:flex-row"
      >
        <div
          class={view === "write" ? "min-w-0" : "hidden min-w-0 md:block"}
          style={paneStyle(ratio)}
        >
          <EditorPane body={draft.body} onBody={(body) => update({ body })} onImages={onImages} />
        </div>

        <div
          class="bg-base-300 hover:bg-primary hidden w-1.5 shrink-0 cursor-col-resize md:block"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
        />

        <div
          class={`border-base-300 ${view === "preview" ? "min-w-0" : "hidden min-w-0 md:block"} md:border-l-0`}
          style={paneStyle(1 - ratio)}
        >
          <PreviewPane body={draft.body} assets={draft.inlineAssets} proseClass={proseClass} />
        </div>
      </div>
    </div>
  );
}
