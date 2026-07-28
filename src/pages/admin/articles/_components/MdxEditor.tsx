import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { isSafeSlug } from "../../../../lib/asset-key";
import { clearDraft, loadDraft, saveDraft } from "../../../../lib/editor/draft-store";
import {
  formatPubDate,
  referencedAssets,
  serializeMdx,
} from "../../../../lib/editor/mdx-serialize";
import { slugifyTitle } from "../../../../lib/editor/slugify";
import { insertAtCursor, replaceInTextarea } from "../../../../lib/editor/textarea";
import type { ArticleDraft } from "../../../../lib/editor/types";
import { uploadAsset } from "../../../../lib/editor/upload";
import EditorPane from "./EditorPane";
import HeroImagePicker from "./HeroImagePicker";
import MetaFields from "./MetaFields";
import PreviewPane from "./PreviewPane";

interface Props {
  proseClass: string;
  /** Server-rendered from the content collection, for collision warnings. */
  existingSlugs?: string[];
  article?: {
    slug: string;
    pubDate: string;
    initial: ArticleDraft;
    extraFrontmatter: string[];
    extraImports: string[];
    /** Resolved server-side, because a committed hero may predate asset keys. */
    heroPreviewUrl?: string;
  };
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "error"; message: string };

const AUTOSAVE_DEBOUNCE_MS = 500;
const MIN_PANE_RATIO = 0.25;
const MAX_PANE_RATIO = 0.75;

export default function MdxEditor({ proseClass, existingSlugs = [], article }: Props) {
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pendingUploads, setPendingUploads] = useState(0);
  const [ratio, setRatio] = useState(0.5);
  const [isWide, setIsWide] = useState(false);

  const splitRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const editing = article !== undefined;
  const draftId = article?.slug ?? "new";

  // Identifies the forked-from revision, so an abandoned draft cannot revert later edits.
  const base = useMemo(() => (article ? JSON.stringify(article.initial) : undefined), [article]);

  useEffect(() => {
    let cancelled = false;

    loadDraft(draftId).then((stored) => {
      if (cancelled) return;
      const usable = stored && stored.base === base ? stored.draft : null;
      // Seeded "Untitled" because image keys embed the slug: untitled cannot upload.
      setDraft(
        usable ??
        article?.initial ?? {
          title: "Untitled",
          description: "",
          body: "",
          inlineAssets: [],
          updatedAt: 0,
        }
      );
      setRestored(usable !== null && editing);
    });

    return () => {
      cancelled = true;
    };
  }, [draftId, base]);

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void saveDraft(draftId, draft, base), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, draftId, base]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // `driver` breaks the echo where moving one pane fires the other's scroll and bounces back.
  useEffect(() => {
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!isWide || !editor || !preview) return;

    let driver: EventTarget | null = null;
    let release: ReturnType<typeof setTimeout>;

    const mirror = (from: HTMLElement, to: HTMLElement) => () => {
      if (driver && driver !== from) return;
      driver = from;
      clearTimeout(release);
      release = setTimeout(() => (driver = null), 120);

      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) return;

      to.scrollTop = (from.scrollTop / fromMax) * toMax;
    };

    const onEditor = mirror(editor, preview);
    const onPreview = mirror(preview, editor);

    editor.addEventListener("scroll", onEditor, { passive: true });
    preview.addEventListener("scroll", onPreview, { passive: true });

    return () => {
      clearTimeout(release);
      editor.removeEventListener("scroll", onEditor);
      preview.removeEventListener("scroll", onPreview);
    };
  }, [isWide]);

  // Autosave covers navigation; an in-flight upload would genuinely be lost.
  useEffect(() => {
    if (pendingUploads === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingUploads]);

  const update = useCallback((patch: Partial<ArticleDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const derivedSlug = useMemo(() => slugifyTitle(draft?.title ?? ""), [draft?.title]);
  const slug = article?.slug ?? derivedSlug;

  const today = useMemo(() => formatPubDate(new Date()), []);
  const pubDate = article?.pubDate ?? today;

  const slugError = useMemo(() => {
    if (editing) return null; // renaming would orphan every inbound link
    if (!slug) return "Give the article a title — the slug comes from it.";
    if (!isSafeSlug(slug)) return "Title must contain letters or numbers.";
    if (existingSlugs.includes(slug)) return "An article with this slug already exists.";
    return null;
  }, [editing, slug, existingSlugs]);

  const committedKeys = useMemo(() => {
    if (!article) return [];
    const hero = article.initial.heroPath;
    return [
      ...article.initial.inlineAssets.filter((asset) => asset.committed).map((a) => a.r2Key),
      // Legacy heroes sit outside what this editor writes, so they never become deletable.
      ...(hero?.startsWith("./") ? [hero.slice(2)] : []),
    ];
  }, [article]);

  // Placeholder first so writing is never blocked and a failure leaves a visible marker.
  const onImages = useCallback(
    async (files: File[], textarea: HTMLTextAreaElement) => {
      if (!slug) {
        setStatus({
          kind: "error",
          message: "Add a title first — the slug decides where images are stored.",
        });
        return;
      }

      // All placeholders before any upload, so a multi-file drop marks every spot at once.
      const jobs = files.map((file) => {
        const token = crypto.randomUUID().slice(0, 8);
        const placeholder = `![Uploading ${file.name}…](uploading:${token})`;
        insertAtCursor(textarea, `\n${placeholder}\n`);
        return { file, placeholder };
      });

      setPendingUploads((count) => count + jobs.length);

      // Direct DOM edit while focused: state would reset `value` and move the caret.
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
          const [, error] = await tryCatch(async () => {
            const { key } = await uploadAsset(file, slug, "content");
            const asset = { id: `img_${key.split("/").pop()!.split("-")[0]}`, r2Key: key };
            const alt = file.name.split(".").slice(0, -1).join(".") || file.name;

            setDraft((current) =>
              current
                ? {
                  ...current,
                  inlineAssets: [...current.inlineAssets, asset],
                }
                : current
            );

            swap(placeholder, `<BlogImage src={${asset.id}} alt=${JSON.stringify(alt)} />`);
          });
          if (error) {
            swap(placeholder, `_Upload failed: ${file.name}_`);
            setStatus({ kind: "error", message: `${file.name}: ${error.message}` });
          }
          setPendingUploads((count) => count - 1);
        })
      );
    },
    [slug]
  );

  const publish = useCallback(async () => {
    if (!draft) return;

    if (!draft.title.trim() || !draft.description.trim()) {
      setStatus({ kind: "error", message: "Title and description are both required." });
      return;
    }
    if (slugError) {
      setStatus({ kind: "error", message: slugError });
      return;
    }
    // Frontmatter alone satisfies the endpoint's non-empty `content` check.
    if (!draft.body.trim()) {
      setStatus({ kind: "error", message: "The article body is empty." });
      return;
    }

    const [, error] = await tryCatch(async () => {
      let ready = draft;

      if (draft.heroFile && !draft.heroKey) {
        setStatus({ kind: "busy", message: "Uploading hero image…" });
        const { key } = await uploadAsset(draft.heroFile, slug, "hero");
        ready = { ...draft, heroKey: key };
        setDraft(ready);
      }

      const kept = referencedAssets(ready.body, ready.inlineAssets);
      const keptKeys = new Set([
        ...kept.map((asset) => asset.r2Key),
        ...(ready.heroKey ? [ready.heroKey] : []),
        ...(ready.heroPath?.startsWith("./") ? [ready.heroPath.slice(2)] : []),
      ]);

      setStatus({ kind: "busy", message: "Committing to GitHub…" });
      const response = await fetch("/api/admin/articles", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          // An edit keeps the original pubDate and records itself in updatedDate.
          content: serializeMdx(ready, {
            pubDate,
            updatedDate: editing ? today : undefined,
            extraFrontmatter: article?.extraFrontmatter ?? [],
            extraImports: article?.extraImports ?? [],
          }),
          imageKey: ready.heroKey,
          // Committed assets are already in the repo and long gone from staging.
          inlineImageKeys: kept.filter((asset) => !asset.committed).map((asset) => asset.r2Key),
          removedKeys: committedKeys.filter((key) => !keptKeys.has(key)),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        sha?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Save failed (${response.status})`);

      // Read back by DeployBanner, which has to survive this redirect.
      if (payload?.sha)
        localStorage.setItem(
          "marknotes-deploy",
          JSON.stringify({ sha: payload.sha, slug, startedAt: Date.now() })
        );

      await clearDraft(draftId);
      window.location.href = editing ? `/admin/articles/${slug}` : "/admin/articles";
    });
    if (error) setStatus({ kind: "error", message: error.message });
  }, [draft, slug, slugError, editing, pubDate, today, article, committedKeys, draftId]);

  const discardLocal = useCallback(async () => {
    if (!article) return;
    await clearDraft(article.slug);
    setDraft(article.initial);
    setRestored(false);
  }, [article]);

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
        <div class="skeleton h-10 w-full" />
        <div class="skeleton h-[70vh] w-full" />
      </div>
    );
  }

  const busy = status.kind === "busy";
  const paneStyle = (share: number) => (isWide ? { width: `${share * 100}%` } : undefined);

  const metaLine = editing
    ? `${slug}.mdx · ${pubDate} · updated ${today} · slug fixed`
    : `${slug || "untitled"}.mdx · ${pubDate}`;

  return (
    <div class="flex flex-col gap-3 px-4 md:min-h-0 md:flex-1">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 md:px-0">
        <h1 class="text-2xl font-bold">{editing ? "Edit article" : "New article"}</h1>
        <div class="flex items-center gap-2">
          {pendingUploads > 0 && (
            <span class="badge badge-neutral badge-lg gap-2">
              <span class="loading loading-spinner loading-xs" />
              {pendingUploads} uploading
            </span>
          )}
          <a href={editing ? `/admin/articles/${slug}` : "/admin/articles"} class="btn btn-ghost">
            Cancel
          </a>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy || pendingUploads > 0}
            onClick={publish}
          >
            {busy && <span class="loading loading-spinner loading-sm" />}
            {editing ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {restored && (
        <div class="alert alert-warning">
          <span>Restored unsaved changes from a previous session.</span>
          <button type="button" class="btn btn-ghost btn-sm" onClick={discardLocal}>
            Discard
          </button>
        </div>
      )}
      {status.kind === "error" && (
        <div class="alert alert-error">
          <span>{status.message}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
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

      <div role="tablist" class="tabs tabs-lift tabs-lg md:hidden">
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

      {/* Bounded height is what makes `overflow-y-auto` engage on the panes. */}
      <div
        ref={splitRef}
        class="card bg-base-100 border-base-300 md:rounded-t-box flex flex-col overflow-hidden rounded-t-none border shadow-sm md:min-h-0 md:flex-1 md:flex-row md:border-0"
      >
        <div
          class={`flex flex-col ${view === "write" ? "min-w-0" : "hidden min-w-0 md:flex"}`}
          style={paneStyle(ratio)}
        >
          <MetaFields
            title={draft.title}
            description={draft.description}
            meta={metaLine}
            slugError={slugError}
            onTitle={(title) => update({ title })}
            onDescription={(description) => update({ description })}
          />
          <EditorPane
            body={draft.body}
            onBody={(body) => update({ body })}
            onImages={onImages}
            textareaRef={textareaRef}
          />
        </div>

        <div
          class="bg-base-300 hover:bg-primary hidden w-1.5 shrink-0 cursor-col-resize md:block"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
        />

        <div
          class={view === "preview" ? "min-w-0" : "hidden min-w-0 md:block"}
          style={paneStyle(1 - ratio)}
        >
          <PreviewPane
            body={draft.body}
            assets={draft.inlineAssets}
            proseClass={proseClass}
            title={draft.title}
            pubDate={pubDate}
            scrollRef={previewRef}
            hero={
              <HeroImagePicker
                file={draft.heroFile}
                uploadedKey={draft.heroKey}
                committedUrl={draft.heroPath ? article?.heroPreviewUrl : undefined}
                onSelect={(heroFile) =>
                  update({ heroFile, heroKey: undefined, heroPath: undefined })
                }
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
