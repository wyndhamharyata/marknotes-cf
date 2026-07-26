/**
 * Existing slugs run to about eight words ("banjarnegara-a-city-frozen-in-time-
 * eaten-alive"), so that is the default shape. It is only a starting point —
 * the editor exposes the slug as an editable field, and the result has to
 * satisfy `isSafeSlug` because it becomes the committed filename.
 */
const MAX_SLUG_WORDS = 8;
const MAX_SLUG_LENGTH = 120;

/** Combining marks that NFKD splits accented characters into. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_SLUG_WORDS)
    .join("-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, ""); // a length truncation can land mid-word
}
