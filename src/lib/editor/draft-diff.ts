import type { ArticleDraft } from "./types";

/**
 * The store stamps `updatedAt` on every save, so only the authored fields say whether a draft
 * holds work the committed article does not.
 */
export function editedSince(draft: ArticleDraft, initial: ArticleDraft): boolean {
  return (
    draft.title !== initial.title ||
    draft.description !== initial.description ||
    draft.body !== initial.body ||
    (draft.rating ?? 0) !== (initial.rating ?? 0) ||
    (draft.heroKey ?? "") !== (initial.heroKey ?? "") ||
    (draft.heroPath ?? "") !== (initial.heroPath ?? "") ||
    draft.heroFile !== undefined
  );
}
