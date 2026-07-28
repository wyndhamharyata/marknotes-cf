const KEY = "marknotes-deploy";

/** Deploy times out at 10 minutes; past this the record is stale, not pending. */
const MAX_AGE_MS = 20 * 60 * 1000;

export interface TrackedDeploy {
  sha: string;
  slug: string;
  startedAt: number;
}

/**
 * localStorage rather than component state, because the banner has to survive
 * the redirect out of the editor and every admin page load after it.
 */
export function trackDeploy(sha: string, slug: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sha, slug, startedAt: Date.now() }));
  } catch {
    // Private-mode storage throws; the commit still landed.
  }
}

export function readTrackedDeploy(): TrackedDeploy | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const record = JSON.parse(raw) as TrackedDeploy;
    if (!record.sha || Date.now() - record.startedAt > MAX_AGE_MS) {
      clearTrackedDeploy();
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export function clearTrackedDeploy(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // as above
  }
}
