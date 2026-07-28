import { createStore, del, get, set } from "idb-keyval";
import type { ArticleDraft } from "./types";

// IndexedDB rather than localStorage because the hero image is held as a File
// until publish, and structured clone can store one.
const store = createStore("marknotes-editor", "drafts");

export interface StoredDraft {
  draft: ArticleDraft;
  /**
   * Fingerprint of the committed article this draft was started from, absent
   * for a new one. A mismatch means the repo moved on underneath an abandoned
   * draft, and restoring it would revert whatever changed it.
   */
  base?: string;
}

/** `id` is the article slug, or `new` for one that has never been published. */
export async function loadDraft(id: string): Promise<StoredDraft | null> {
  // Blocked storage must not leave the editor stuck on its skeleton.
  try {
    return (await get<StoredDraft>(id, store)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(id: string, draft: ArticleDraft, base?: string): Promise<void> {
  await set(id, { draft: { ...draft, updatedAt: Date.now() }, base }, store).catch(() => {});
}

export async function clearDraft(id: string): Promise<void> {
  await del(id, store).catch(() => {});
}
