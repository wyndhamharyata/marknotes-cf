import type { ArticleDraft, InlineAsset } from "./types";

const BLOG_IMAGE_IMPORT = "../../pages/articles/_components/BlogImage.astro";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Matches existing frontmatter, zero-padded day included: "Sep 01 2023". */
export function formatPubDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")} ${date.getFullYear()}`;
}

/**
 * Assets still referenced by the body, deduplicated by identifier.
 *
 * Filtering by reference is what stops a deleted `<BlogImage>` line from
 * committing its image to the repo anyway. Deduplicating turns an identifier
 * collision from a duplicate `import` — a build error — into a repeated image.
 */
export function referencedAssets(body: string, assets: InlineAsset[]): InlineAsset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id) || !new RegExp(`\\b${asset.id}\\b`).test(body)) return false;
    seen.add(asset.id);
    return true;
  });
}

export function serializeMdx(draft: ArticleDraft, pubDate: string): string {
  const assets = referencedAssets(draft.body, draft.inlineAssets);

  const frontmatter = [
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${yamlString(pubDate)}`,
    draft.heroKey ? `heroImage: ${yamlString(`./${draft.heroKey}`)}` : null,
  ].filter((line): line is string => line !== null);

  // Imports are generated so the author never maintains an import block by hand.
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

function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .trim();
  return `"${escaped}"`;
}
