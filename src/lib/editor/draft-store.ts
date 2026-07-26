import type { ArticleDraft } from "./types";

/**
 * Single-draft autosave backed by IndexedDB.
 *
 * IndexedDB rather than localStorage for one concrete reason: a hero image is
 * chosen as a `File` and only uploaded on save, and structured clone can store
 * a File where a string-only store cannot. Async writes also keep a 500ms
 * autosave off the main thread while typing.
 *
 * Every operation degrades to a no-op if IndexedDB is unavailable (private
 * browsing, blocked storage) — losing a draft is bad, but blocking the editor
 * from opening is worse.
 */
const DB_NAME = "marknotes-editor";
const DB_VERSION = 1;
const STORE = "drafts";
const DRAFT_ID = "new";

interface StoredDraft extends ArticleDraft {
  id: string;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;

  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    return await run(db.transaction(STORE, mode).objectStore(STORE));
  } catch (error) {
    console.warn("Draft storage unavailable:", error);
    return null;
  } finally {
    db?.close();
  }
}

export async function loadDraft(): Promise<ArticleDraft | null> {
  const stored = await withStore("readonly", (store) =>
    promisify<StoredDraft | undefined>(store.get(DRAFT_ID))
  );
  if (!stored) return null;

  const { id: _id, ...draft } = stored;
  return draft;
}

export async function saveDraft(draft: ArticleDraft): Promise<void> {
  await withStore("readwrite", (store) =>
    promisify(store.put({ ...draft, id: DRAFT_ID, updatedAt: Date.now() }))
  );
}

export async function clearDraft(): Promise<void> {
  await withStore("readwrite", (store) => promisify(store.delete(DRAFT_ID)));
}

/**
 * Ask the browser not to evict this origin's storage under disk pressure.
 * Best-effort and silently ignored where unsupported.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported, or the user declined. Drafts still work.
  }
}
