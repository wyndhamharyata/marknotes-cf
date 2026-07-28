import { isSafeAssetKey } from "../asset-key";
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

export interface MdxMeta {
  pubDate: string;
  updatedDate?: string;
  /** Frontmatter lines this module does not model, replayed verbatim. */
  extraFrontmatter?: string[];
  /** Import lines this module does not model, replayed verbatim. */
  extraImports?: string[];
}

export function serializeMdx(draft: ArticleDraft, meta: MdxMeta): string {
  const assets = referencedAssets(draft.body, draft.inlineAssets);

  // A hero uploaded this session wins; otherwise the committed path stands.
  const heroValue = draft.heroKey ? `./${draft.heroKey}` : draft.heroPath;

  const frontmatter = [
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${yamlString(meta.pubDate)}`,
    meta.updatedDate ? `updatedDate: ${yamlString(meta.updatedDate)}` : null,
    heroValue ? `heroImage: ${yamlString(heroValue)}` : null,
    ...(meta.extraFrontmatter ?? []),
  ].filter((line): line is string => line !== null);

  // Imports are generated so the author never maintains an import block by hand.
  const imports: string[] = [...(meta.extraImports ?? [])];
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

export interface ParsedArticle {
  draft: ArticleDraft;
  /** Verbatim, so an edit never restamps the original publish date. */
  pubDate: string;
  extraFrontmatter: string[];
  extraImports: string[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;
const FRONTMATTER_LINE = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/;
const IMPORT_LINE = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["'];?[ \t]*$/;

const MODELLED = new Set(["title", "description", "pubDate", "updatedDate", "heroImage"]);

/**
 * The inverse of `serializeMdx`, over a file this editor may not have written.
 *
 * Anything unmodelled is carried through rather than dropped, and a frontmatter
 * line that is neither blank, a comment nor `key: value` throws — refusing to
 * open an article is recoverable, silently rewriting its frontmatter is not.
 */
export function parseMdx(source: string): ParsedArticle {
  const normalized = source.replace(/\r\n/g, "\n");
  const match = FRONTMATTER.exec(normalized);
  if (!match) throw new Error("Article has no frontmatter block");

  const fields = new Map<string, string>();
  const extraFrontmatter: string[] = [];

  for (const line of match[1].split("\n")) {
    if (line.trim() === "") continue;

    const field = FRONTMATTER_LINE.exec(line);
    if (!field) {
      if (line.trimStart().startsWith("#")) extraFrontmatter.push(line);
      else throw new Error(`Cannot parse frontmatter line: ${line.slice(0, 60)}`);
      continue;
    }

    const [, key, value] = field;
    if (MODELLED.has(key)) fields.set(key, unquote(value));
    else extraFrontmatter.push(line);
  }

  const pubDate = fields.get("pubDate");
  if (!pubDate) throw new Error("Article frontmatter has no pubDate");

  const { body, inlineAssets, extraImports } = splitImports(
    normalized.slice(match[0].length).replace(/^\n+/, "")
  );

  return {
    draft: {
      title: fields.get("title") ?? "",
      description: fields.get("description") ?? "",
      body,
      heroPath: fields.get("heroImage"),
      inlineAssets,
      updatedAt: 0,
    },
    pubDate,
    extraFrontmatter,
    extraImports,
  };
}

/**
 * Peels the leading import block off the body.
 *
 * Only the run of imports before the first content line is considered, so a Go
 * `import (` inside a later fence is left in the body where it belongs.
 */
function splitImports(rest: string) {
  const lines = rest.split("\n");
  const inlineAssets: InlineAsset[] = [];
  const extraImports: string[] = [];

  let cursor = 0;
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    if (line.trim() === "") continue;

    const parsed = IMPORT_LINE.exec(line);
    if (!parsed) break;

    const [, id, specifier] = parsed;
    const key = specifier.startsWith("./") ? specifier.slice(2) : null;

    if (specifier.endsWith("BlogImage.astro")) continue; // regenerated on write
    else if (key && isSafeAssetKey(key)) inlineAssets.push({ id, r2Key: key, committed: true });
    else extraImports.push(line);
  }

  return { body: lines.slice(cursor).join("\n").trim(), inlineAssets, extraImports };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || !trimmed.endsWith(quote) || trimmed.length < 2)
    return trimmed;
  return trimmed.slice(1, -1).replace(/\\(.)/g, "$1");
}

function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .trim();
  return `"${escaped}"`;
}
