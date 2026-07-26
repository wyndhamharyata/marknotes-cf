/**
 * An image dropped into the body and already uploaded to R2 staging.
 *
 * `r2Key` is the only durable handle: it is simultaneously the staging key, the
 * repo path suffix (`src/content/blog/${r2Key}`) and — because the article MDX
 * sits at `src/content/blog/${slug}.mdx` — the relative import path `./${r2Key}`.
 * Nothing here is derived from the current slug, so renaming a draft after
 * uploading images stays correct.
 */
export interface InlineAsset {
  /** JS identifier bound by the generated MDX import, e.g. `img_a1b2c3d4`. */
  id: string;
  r2Key: string;
  alt: string;
}

export interface ArticleDraft {
  title: string;
  slug: string;
  description: string;
  /** Frontmatter-formatted, e.g. "Jul 26 2026". */
  pubDate: string;
  /** Markdown only — frontmatter and imports are generated at serialize time. */
  body: string;
  /** Set once the hero has been uploaded to staging. */
  heroKey?: string;
  /**
   * Hero chosen but not yet uploaded. Persisted as-is; IndexedDB stores File via
   * structured clone, which is the reason this editor does not use localStorage.
   */
  heroFile?: File;
  inlineAssets: InlineAsset[];
  updatedAt: number;
}

export function emptyDraft(pubDate: string): ArticleDraft {
  return {
    title: "",
    slug: "",
    description: "",
    pubDate,
    body: "",
    inlineAssets: [],
    updatedAt: 0,
  };
}
