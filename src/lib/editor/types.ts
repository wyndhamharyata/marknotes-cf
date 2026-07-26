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

/**
 * Only authored fields live here. The slug is always `slugifyTitle(title)` and
 * the publish date is always the day of publishing, so both are computed where
 * they are needed rather than stored — state that cannot drift out of sync.
 */
export interface ArticleDraft {
  title: string;
  description: string;
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

/**
 * A new draft starts titled rather than blank: the slug comes from the title and
 * image keys come from the slug, so an untitled draft cannot accept an upload.
 */
export const DEFAULT_TITLE = "Untitled";

export function emptyDraft(): ArticleDraft {
  return {
    title: DEFAULT_TITLE,
    description: "",
    body: "",
    inlineAssets: [],
    updatedAt: 0,
  };
}
