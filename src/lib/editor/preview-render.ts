import type { Marked, Token } from "marked";
import { highlightCode } from "./highlight";
import type { InlineAsset } from "./types";
import { repoAssetUrl, stagedAssetUrl } from "./upload";

// Loaded lazily so the textarea is interactive before the parser arrives.
// Output is injected unsanitised: admin-only editor, admin's own draft.
let markedModule: Promise<typeof import("marked")> | null = null;

function loadMarked() {
  markedModule ??= import("marked");
  return markedModule;
}

const BLOG_IMAGE_TAG = /<BlogImage\s+([^>]*?)\/>/g;

const UPLOAD_PLACEHOLDER = /!\[Uploading ([^\]]*)\]\(uploading:[^)]*\)/g;

const ATTRIBUTE = /([A-Za-z]+)\s*=\s*(?:"([^"]*)"|\{([A-Za-z_$][\w$]*)\})/g;

export async function renderPreview(body: string, assets: InlineAsset[]): Promise<string> {
  const { Marked } = await loadMarked();
  const prepared = expandBlogImages(markUploads(body), assets);

  const instance = new Marked({ gfm: true, async: false });

  // Shiki is async and marked's `code` renderer is not.
  const highlighted = await highlightAll(instance, prepared);

  instance.use({
    renderer: {
      code({ text, lang }) {
        return highlighted.get(fenceKey(lang, text)) ?? plainCode(text, lang);
      },
    },
  });

  return instance.parse(prepared, { async: false }) as string;
}

const fenceKey = (lang: string | undefined, text: string) => `${lang ?? ""}|${text}`;

async function highlightAll(instance: Marked, markdown: string) {
  const fences = new Map<string, { lang?: string; text: string }>();

  // marked's own walker: list items keep children under `items`, which a naive
  // `token.tokens` recursion misses.
  instance.walkTokens(instance.lexer(markdown), (token: Token) => {
    if (token.type === "code") {
      fences.set(fenceKey(token.lang, token.text), { lang: token.lang, text: token.text });
    }
  });

  const results = new Map<string, string>();
  await Promise.all(
    [...fences].map(async ([key, { lang, text }]) => {
      const html = await highlightCode(text, lang);
      if (html) results.set(key, html);
    })
  );

  return results;
}

function plainCode(text: string, lang?: string): string {
  const className = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  return `<pre><code${className}>${escapeHtml(text)}\n</code></pre>`;
}

function markUploads(body: string): string {
  return body.replace(
    UPLOAD_PLACEHOLDER,
    (_match, name: string) =>
      `<span class="badge badge-neutral gap-2"><span class="loading loading-spinner loading-xs"></span>Uploading ${escapeHtml(name)}</span>`
  );
}

// Mirrors BlogImage.astro's markup so the preview matches the published page.
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
    if (!asset) return null;
    return asset.committed ? repoAssetUrl(asset.r2Key) : stagedAssetUrl(asset.r2Key);
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
