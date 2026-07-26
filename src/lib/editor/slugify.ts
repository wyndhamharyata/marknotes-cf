// Matches the shape of existing slugs, which run to about eight words.
const MAX_SLUG_WORDS = 8;
const MAX_SLUG_LENGTH = 120;

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_SLUG_WORDS)
    .join("-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}
