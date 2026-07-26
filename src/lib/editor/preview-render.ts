import type { InlineAsset } from "./types";
import { stagedAssetUrl } from "./upload";

/**
 * Renders editor markdown to preview HTML.
 *
 * `marked` is loaded lazily so the textarea is interactive before the parser
 * chunk arrives — it is the only third-party weight on this route.
 *
 * The output is injected with dangerouslySetInnerHTML and is deliberately not
 * sanitised: this is an admin-only editor rendering the admin's own draft, and
 * the published article goes through Astro's MDX pipeline rather than this one.
 */
let markedModule: Promise<typeof import("marked")> | null = null;

function loadMarked() {
  markedModule ??= import("marked");
  return markedModule;
}

/** `<BlogImage ... />`, which marked would otherwise emit as an unknown element. */
const BLOG_IMAGE_TAG = /<BlogImage\s+([^>]*?)\/>/g;

/** The in-flight upload marker `EditorPane` drops at the cursor. */
const UPLOAD_PLACEHOLDER = /!\[Uploading ([^\]]*)\]\(uploading:[^)]*\)/g;

const ATTRIBUTE = /([A-Za-z]+)\s*=\s*(?:"([^"]*)"|\{([A-Za-z_$][\w$]*)\})/g;

export async function renderPreview(body: string, assets: InlineAsset[]): Promise<string> {
  const { marked } = await loadMarked();
  const prepared = expandBlogImages(markUploads(body), assets);
  return marked.parse(prepared, { async: false, gfm: true }) as string;
}

/** Show an in-progress chip instead of a broken image while an upload runs. */
function markUploads(body: string): string {
  return body.replace(
    UPLOAD_PLACEHOLDER,
    (_match, name: string) =>
      `<span class="badge badge-neutral gap-2"><span class="loading loading-spinner loading-xs"></span>Uploading ${escapeHtml(name)}</span>`
  );
}

/**
 * Mirrors BlogImage.astro's markup so the preview matches the published page.
 * `src={identifier}` resolves through the staging proxy; a quoted src is used
 * as-is, which covers hand-written tags pointing at remote URLs.
 */
function expandBlogImages(body: string, assets: InlineAsset[]): string {
  return body.replace(BLOG_IMAGE_TAG, (_match, rawAttrs: string) => {
    const attrs = parseAttributes(rawAttrs);
    const src = resolveSrc(attrs.src, assets);
    const alt = escapeHtml(attrs.alt ?? "");

    if (!src) {
      return `<div class="alert alert-warning my-6">Image not found: ${escapeHtml(attrs.src ?? "(no src)")}</div>`;
    }

    const caption = attrs.caption
      ? `<figcaption class="text-base-content/70 mt-2 text-center text-sm italic">${escapeHtml(attrs.caption)}</figcaption>`
      : "";

    return `<figure class="my-6"><img src="${escapeHtml(src)}" alt="${alt}" class="mx-auto max-w-full rounded-lg shadow-md" loading="lazy" />${caption}</figure>`;
  });
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(ATTRIBUTE)) {
    const [, name, quoted, identifier] = match;
    // Braces are retained so resolveSrc can tell `src={img_x}` from `src="url"`.
    attrs[name] = quoted !== undefined ? quoted : `{${identifier}}`;
  }
  return attrs;
}

function resolveSrc(value: string | undefined, assets: InlineAsset[]): string | null {
  if (!value) return null;

  if (value.startsWith("{")) {
    const id = value.slice(1, -1);
    const asset = assets.find((candidate) => candidate.id === id);
    return asset ? stagedAssetUrl(asset.r2Key) : null;
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
