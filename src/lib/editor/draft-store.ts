import { createStore, del, get, set } from "idb-keyval";
import type { ArticleDraft } from "./types";

// IndexedDB rather than localStorage because the hero image is held as a File
// until publish, and structured clone can store one.
const store = createStore("marknotes-editor", "drafts");
const DRAFT = "new";

export async function loadDraft(): Promise<ArticleDraft | null> {
  // Blocked storage must not leave the editor stuck on its skeleton.
  try {
    return (await get<ArticleDraft>(DRAFT, store)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: ArticleDraft): Promise<void> {
  await set(DRAFT, { ...draft, updatedAt: Date.now() }, store).catch(() => {});
}

export async function clearDraft(): Promise<void> {
  await del(DRAFT, store).catch(() => {});
}
