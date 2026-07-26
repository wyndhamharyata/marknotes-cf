import type { ArticleDraft, InlineAsset } from "./types";

/** Relative to `src/content/blog/<slug>.mdx`, where every article is committed. */
const BLOG_IMAGE_IMPORT = "../../pages/articles/_components/BlogImage.astro";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Matches the existing frontmatter, including the zero-padded day ("Sep 01 2023"). */
export function formatPubDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  return `${MONTHS[date.getMonth()]} ${day} ${date.getFullYear()}`;
}

/** Stable JS identifier for an asset, derived from the random part of its key. */
export function assetIdFromKey(r2Key: string): string {
  const filename = r2Key.split("/").pop() ?? "";
  const random = filename.split("-")[0]?.replace(/[^a-z0-9]/gi, "") || "asset";
  return `img_${random}`;
}

/** The MDX snippet inserted at the cursor when an image finishes uploading. */
export function inlineImageSnippet(asset: InlineAsset): string {
  return `<BlogImage src={${asset.id}} alt=${JSON.stringify(asset.alt)} />`;
}

/**
 * Only the assets still referenced by the body get imported and committed.
 *
 * Without this, deleting a `<BlogImage>` line would leave a dangling import
 * (breaking the build is unlikely, but the orphaned image would still be
 * committed to the repo forever).
 */
export function referencedAssets(body: string, assets: InlineAsset[]): InlineAsset[] {
  const referenced = assets.filter((asset) => new RegExp(`\\b${asset.id}\\b`).test(body));

  // Identifiers come from an 8-hex random, so a clash is vanishingly unlikely —
  // but emitting the same `import` twice is a build-breaking syntax error,
  // whereas keeping the first is merely a duplicated image. Prefer the latter.
  const seen = new Set<string>();
  return referenced.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

/**
 * Body text is authored without frontmatter or imports; both are generated here
 * so the author never has to maintain an import block by hand. The BlogImage
 * import is emitted whenever the body mentions the component at all, which
 * covers hand-written tags with remote URLs as well as dropped images.
 *
 * `pubDate` is a parameter rather than a draft field because it is always the
 * day of publishing, never the day the draft was started.
 */
export function serializeMdx(draft: ArticleDraft, pubDate: string): string {
  const assets = referencedAssets(draft.body, draft.inlineAssets);

  const frontmatter = [
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${yamlString(pubDate)}`,
    draft.heroKey ? `heroImage: ${yamlString(`./${draft.heroKey}`)}` : null,
  ].filter((line): line is string => line !== null);

  const imports: string[] = [];
  if (draft.body.includes("<BlogImage")) {
    imports.push(`import BlogImage from ${JSON.stringify(BLOG_IMAGE_IMPORT)};`);
  }
  for (const asset of assets) {
    imports.push(`import ${asset.id} from ${JSON.stringify(`./${asset.r2Key}`)};`);
  }

  const sections = [`---\n${frontmatter.join("\n")}\n---`];
  if (imports.length > 0) sections.push(imports.join("\n"));
  sections.push(draft.body.trim());

  return `${sections.join("\n\n")}\n`;
}

/** Keys the save request must ask the server to pull out of staging. */
export function referencedInlineKeys(draft: ArticleDraft): string[] {
  return referencedAssets(draft.body, draft.inlineAssets).map((asset) => asset.r2Key);
}

/** Frontmatter is double-quoted YAML, so backslashes and quotes need escaping. */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .trim();
  return `"${escaped}"`;
}
