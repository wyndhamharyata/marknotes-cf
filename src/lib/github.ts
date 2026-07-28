const REPO = "wyndhamharyata/marknotes-cf";

/** `path` is repo-relative, e.g. `/git/refs/heads/main` or `/contents/README.md`. */
async function ghApi(path: string, init?: RequestInit): Promise<Response> {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const resp = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      "User-Agent": "marknotes-cf/1.0",
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-Github-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "unreadable");
    throw new Error(`Github API error: ${resp.status}: ${body.slice(0, 200)}`);
  }

  return resp;
}

/**
 * A file as it exists on `main` right now.
 *
 * The content collection is baked at build time, so between a publish and the
 * end of its deploy it still serves the previous commit. Anything that will be
 * written back has to be read from here instead, or the write reverts it.
 */
export async function readRepoFile(path: string): Promise<Response | null> {
  const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=main`, {
    headers: {
      "User-Agent": "marknotes-cf/1.0",
      // Raw, so the 1MB ceiling on the JSON representation does not apply.
      Accept: "application/vnd.github.raw",
      Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}`,
      "X-Github-Api-Version": "2022-11-28",
    },
  });

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Github API error: ${resp.status}`);

  return resp;
}

export interface CommitInput {
  slug: string;
  mdxContent: string;
  message: string;
  /** `slug` and every `r2Key` must already be validated by the caller. */
  assets?: { r2Key: string; buffer: ArrayBuffer }[];
  /** Blog-relative keys to remove, already validated as owned by `slug`. */
  removedKeys?: string[];
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  /** Null deletes the path from the base tree. */
  sha: string | null;
}

const BLOG_DIR = "src/content/blog";

export async function commitMdx(input: CommitInput): Promise<{ sha: string }> {
  const assets = input.assets ?? [];

  const lastHeadResp = await ghApi("/git/refs/heads/main");
  const ref = (await lastHeadResp.json()) as { object: { sha: string } };
  const headSHA = ref.object.sha;

  const baseCommitResp = await ghApi(`/git/commits/${headSHA}`);
  const baseCommit = (await baseCommitResp.json()) as { tree: { sha: string } };
  const baseTreeSHA = baseCommit.tree.sha;

  // Blobs must be JSON with base64 content; a raw body gets a 403.
  const createBlob = async (base64: string): Promise<string> => {
    const resp = await ghApi("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: base64, encoding: "base64" }),
    });
    const blob = (await resp.json()) as { sha: string };
    return blob.sha;
  };

  const [mdxSHA, assetSHAs] = await Promise.all([
    createBlob(toBase64(new TextEncoder().encode(input.mdxContent))),
    Promise.all(assets.map((asset) => createBlob(toBase64(new Uint8Array(asset.buffer))))),
  ]);

  const treeEntries: TreeEntry[] = [
    {
      path: `${BLOG_DIR}/${input.slug}.mdx`,
      mode: "100644",
      type: "blob",
      sha: mdxSHA,
    },
    ...assets.map((asset, i) => ({
      path: `${BLOG_DIR}/${asset.r2Key}`,
      mode: "100644",
      type: "blob",
      sha: assetSHAs[i],
    })),
    ...(input.removedKeys ?? []).map((key) => ({
      path: `${BLOG_DIR}/${key}`,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const treeResp = await ghApi("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSHA, tree: treeEntries }),
  });
  const newTree = (await treeResp.json()) as { sha: string };

  const newCommitResp = await ghApi("/git/commits", {
    method: "POST",
    body: JSON.stringify({ message: input.message, tree: newTree.sha, parents: [headSHA] }),
  });
  const newCommit = (await newCommitResp.json()) as { sha: string };

  await ghApi("/git/refs/heads/main", {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return { sha: newCommit.sha };
}

export interface DeployRun {
  /** `queued`, `in_progress` or `completed`. */
  status: string;
  /** Only set once `status` is `completed`. */
  conclusion: string | null;
  htmlUrl: string;
}

/**
 * The deploy workflow's run for one commit, or null while GitHub has accepted
 * the push but not yet created the run.
 */
export async function deployRunForSha(sha: string): Promise<DeployRun | null> {
  const resp = await ghApi(
    `/actions/workflows/deploy.yml/runs?head_sha=${encodeURIComponent(sha)}&per_page=1`
  );
  const body = (await resp.json()) as {
    workflow_runs: { status: string; conclusion: string | null; html_url: string }[];
  };

  const run = body.workflow_runs[0];
  return run ? { status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url } : null;
}

// Chunked because a concatenation per byte is a real CPU cost on a Worker once
// a commit carries several megabytes of images.
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
