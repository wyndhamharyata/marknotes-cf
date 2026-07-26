async function ghApi(path: string, init?: RequestInit): Promise<Response> {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const url = `https://api.github.com/repos/wyndhamharyata/marknotes-cf/git${path}`;

  const resp = await fetch(url, {
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

export interface CommitInput {
  slug: string;
  mdxContent: string;
  /** `slug` and every `r2Key` must already be validated by the caller. */
  assets?: { r2Key: string; buffer: ArrayBuffer }[];
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export async function commitMdx(input: CommitInput): Promise<{ ok: boolean }> {
  const assets = input.assets ?? [];

  const lastHeadResp = await ghApi("/refs/heads/main");
  const ref = (await lastHeadResp.json()) as { object: { sha: string } };
  const headSHA = ref.object.sha;

  const baseCommitResp = await ghApi(`/commits/${headSHA}`);
  const baseCommit = (await baseCommitResp.json()) as { tree: { sha: string } };
  const baseTreeSHA = baseCommit.tree.sha;

  // Blobs must be JSON with base64 content; a raw body gets a 403.
  const createBlob = async (base64: string): Promise<string> => {
    const resp = await ghApi("/blobs", {
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
      path: `src/content/blog/${input.slug}.mdx`,
      mode: "100644",
      type: "blob",
      sha: mdxSHA,
    },
    ...assets.map((asset, i) => ({
      path: `src/content/blog/${asset.r2Key}`,
      mode: "100644",
      type: "blob",
      sha: assetSHAs[i],
    })),
  ];

  const treeResp = await ghApi("/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSHA, tree: treeEntries }),
  });
  const newTree = (await treeResp.json()) as { sha: string };

  const title = `content: new content push from admin panel - ${input.slug} - ${crypto.randomUUID().split("-").pop()}`;

  const newCommitResp = await ghApi("/commits", {
    method: "POST",
    body: JSON.stringify({ message: title, tree: newTree.sha, parents: [headSHA] }),
  });
  const newCommit = (await newCommitResp.json()) as { sha: string };

  await ghApi("/refs/heads/main", {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return { ok: true };
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
