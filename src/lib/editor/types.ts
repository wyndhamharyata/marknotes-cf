export interface InlineAsset {
  id: string;
  /** Staging key, repo path suffix and relative import path all at once. */
  r2Key: string;
  /** Already committed by an earlier publish, so staging no longer holds it. */
  committed?: boolean;
}

/** Authored fields only — slug and publish date are derived where they are used. */
export interface ArticleDraft {
  title: string;
  description: string;
  body: string;
  heroKey?: string;
  heroPath?: string;
  /** Chosen but not yet uploaded; IndexedDB can store a File, localStorage cannot. */
  heroFile?: File;
  inlineAssets: InlineAsset[];
  /** Coffee reviews only; Kopimap shows it on the shop. */
  rating?: number;
  updatedAt: number;
}
