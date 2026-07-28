import { isSafeAssetKey } from "../asset-key";
import type { ArticleDraft, InlineAsset } from "./types";

/** Matches existing frontmatter, zero-padded day included: "Sep 01 2023". */
export function formatPubDate(date: Date): string {
  const month = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[date.getMonth()];
  return `${month} ${String(date.getDate()).padStart(2, "0")} ${date.getFullYear()}`;
}

// Filtering by reference stops a deleted `<BlogImage>` committing its image anyway.
export function referencedAssets(body: string, assets: InlineAsset[]): InlineAsset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id) || !body.includes(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

export function serializeMdx(
  draft: ArticleDraft,
  meta: {
    pubDate: string;
    updatedDate?: string;
    extraFrontmatter: string[];
    extraImports: string[];
  }
): string {
  const assets = referencedAssets(draft.body, draft.inlineAssets);
  // A hero uploaded this session wins over the one already committed.
  const hero = draft.heroKey ? `./${draft.heroKey}` : draft.heroPath;

  const frontmatter = [
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${yamlString(meta.pubDate)}`,
    meta.updatedDate ? `updatedDate: ${yamlString(meta.updatedDate)}` : null,
    hero ? `heroImage: ${yamlString(hero)}` : null,
    ...meta.extraFrontmatter,
  ].filter((line): line is string => line !== null);

  // Imports are generated so the author never maintains an import block by hand.
  const imports: string[] = [];
  if (draft.body.includes("<BlogImage")) {
    imports.push(`import BlogImage from "../../pages/articles/_components/BlogImage.astro";`);
  }
  for (const asset of assets) {
    imports.push(`import ${asset.id} from "./${asset.r2Key}";`);
  }
  // Last, so an article that already had its own component import round-trips.
  imports.push(...meta.extraImports);

  const sections = [`---\n${frontmatter.join("\n")}\n---`];
  if (imports.length > 0) sections.push(imports.join("\n"));
  sections.push(draft.body.trim());

  return `${sections.join("\n\n")}\n`;
}

/** The inverse of `serializeMdx`, over a file this editor may not have written. */
export function parseMdx(source: string) {
  if (!source.startsWith("---\n")) throw new Error("Article has no frontmatter block");

  const close = source.indexOf("\n---", 4);
  if (close === -1) throw new Error("Article frontmatter is never closed");

  const fields = new Map<string, string>();
  const extraFrontmatter: string[] = [];

  for (const line of source.slice(4, close).split("\n")) {
    if (line.trim() === "") continue;

    const colon = line.indexOf(":");
    const key = colon > 0 ? line.slice(0, colon) : "";
    // Refusing to open an article is recoverable; rewriting its frontmatter is not.
    if (!key || key.includes(" "))
      throw new Error(`Cannot parse frontmatter: ${line.slice(0, 60)}`);

    const value = line.slice(colon + 1).trim();
    if (["title", "description", "pubDate", "updatedDate", "heroImage"].includes(key)) {
      fields.set(key, value.startsWith('"') ? (JSON.parse(value) as string) : value);
    } else {
      extraFrontmatter.push(line);
    }
  }

  const pubDate = fields.get("pubDate");
  if (!pubDate) throw new Error("Article frontmatter has no pubDate");

  const lines = source.slice(source.indexOf("\n", close + 1) + 1).split("\n");
  const inlineAssets: InlineAsset[] = [];
  const extraImports: string[] = [];

  // Only the run before the first content line, so a Go `import (` stays in the body.
  let cursor = 0;
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor].trim();
    if (line === "") continue;

    const from = line.startsWith("import ") ? line.indexOf(" from ") : -1;
    if (from === -1) break;

    // Quote to matching quote, so an optional trailing semicolon drops out.
    const quoted = line.slice(from + 6).trim();
    const specifier = quoted.slice(1, quoted.lastIndexOf(quoted[0]));

    if (specifier.endsWith("BlogImage.astro")) continue; // regenerated on write

    const key = specifier.startsWith("./") ? specifier.slice(2) : "";
    if (isSafeAssetKey(key)) {
      inlineAssets.push({ id: line.slice(7, from).trim(), r2Key: key, committed: true });
    } else {
      extraImports.push(lines[cursor]);
    }
  }

  return {
    draft: {
      title: fields.get("title") ?? "",
      description: fields.get("description") ?? "",
      body: lines.slice(cursor).join("\n").trim(),
      heroPath: fields.get("heroImage"),
      inlineAssets,
      updatedAt: 0,
    } satisfies ArticleDraft,
    pubDate,
    extraFrontmatter,
    extraImports,
  };
}

// YAML double-quoted accepts JSON escaping, so this inverts parseMdx's JSON.parse exactly.
function yamlString(value: string): string {
  const oneLine = value.replaceAll("\r", "\n").split("\n").filter(Boolean).join(" ");
  return JSON.stringify(oneLine.trim());
}
