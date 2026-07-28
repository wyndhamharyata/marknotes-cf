import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import { createStore, del, get, set } from "idb-keyval";
import type { ArticleDraft } from "./types";

// IndexedDB, not localStorage: only structured clone can hold the hero File.
const store = createStore("marknotes-editor", "drafts");

/** `id` is the article slug, or `new` for one that has never been published. */
export async function loadDraft(id: string) {
  // Blocked storage must not leave the editor stuck on its skeleton.
  const [record] = await tryCatch(get<{ draft: ArticleDraft; base?: string }>(id, store));
  return record ?? null;
}

export async function saveDraft(id: string, draft: ArticleDraft, base?: string) {
  await set(id, { draft: { ...draft, updatedAt: Date.now() }, base }, store).catch(() => {});
}

export async function clearDraft(id: string) {
  await del(id, store).catch(() => {});
}
