/** `path` is repo-relative: `/git/refs/heads/main`, `/contents/README.md`. */
export async function ghApi(path: string, init?: RequestInit): Promise<Response> {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const resp = await fetch(`https://api.github.com/repos/wyndhamharyata/marknotes-cf${path}`, {
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

export async function commitMdx(input: {
  slug: string;
  mdxContent: string;
  message: string;
  /** `slug`, every `r2Key` and every removed key must be validated by the caller. */
  assets: { r2Key: string; buffer: ArrayBuffer }[];
  removedKeys: string[];
}): Promise<{ sha: string }> {
  const lastHeadResp = await ghApi("/git/refs/heads/main");
  const ref = (await lastHeadResp.json()) as { object: { sha: string } };
  const headSHA = ref.object.sha;

  const baseCommitResp = await ghApi(`/git/commits/${headSHA}`);
  const baseCommit = (await baseCommitResp.json()) as { tree: { sha: string } };

  const payloads = [
    new TextEncoder().encode(input.mdxContent),
    ...input.assets.map((asset) => new Uint8Array(asset.buffer)),
  ];

  const shas = await Promise.all(
    payloads.map(async (bytes) => {
      // Chunked: a concatenation per byte is real CPU cost on a Worker once a
      // commit carries several megabytes of images.
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }

      // Blobs must be JSON with base64 content; a raw body gets a 403.
      const resp = await ghApi("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: btoa(binary), encoding: "base64" }),
      });
      return ((await resp.json()) as { sha: string }).sha;
    })
  );

  const tree: { path: string; mode: string; type: string; sha: string | null }[] = [
    { path: `src/content/blog/${input.slug}.mdx`, mode: "100644", type: "blob", sha: shas[0] },
    ...input.assets.map((asset, i) => ({
      path: `src/content/blog/${asset.r2Key}`,
      mode: "100644",
      type: "blob",
      sha: shas[i + 1],
    })),
    // A null sha removes the path from the base tree.
    ...input.removedKeys.map((key) => ({
      path: `src/content/blog/${key}`,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const treeResp = await ghApi("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
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
