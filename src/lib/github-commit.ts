async function ghApi(path: string, init?: RequestInit): Promise<Response> {
  const token = import.meta.env.GITHUB_TOKEN; // will generate on deployment
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const url = `https://api.github.com/repos/wyndhamharyata/marknotes-cf/git${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-Github-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Github API error; Status: ${resp.status}; Error: ${err.message ?? "none"}`);
  }

  return resp;
}

export interface CommitInput {
  slug: string;
  mdxContent: string;
  imageR2Key?: string;
  imageBuffer?: ArrayBuffer;
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export async function commitMdx(input: CommitInput): Promise<{ ok: boolean }> {
  const lastHeadResp = await ghApi("/refs/heads/main");
  const ref = (await lastHeadResp.json()) as { object: { sha: string } };
  const headSHA = ref.object.sha;

  const baseCommitResp = await ghApi(`/commits/${headSHA}`);
  const baseCommit = (await baseCommitResp.json()) as { tree: { sha: string } };
  const baseTreeSHA = baseCommit.tree.sha;

  const [mdxBlob, imageBlob] = await Promise.all([
    ghApi("/blobs", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: input.mdxContent,
    }),
    (input.imageBuffer?.byteLength ?? 0 > 0)
      ? ghApi("/blobs", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: input.imageBuffer,
        })
      : null,
  ]);

  const mdx = (await mdxBlob.json()) as { sha: string };
  const image = imageBlob && ((await imageBlob.json()) as { sha: string });
  const imagePath = `src/content/blog/hero-images/${input.imageR2Key?.split("/").pop() ?? input.slug + ".jpg"}`;

  // Build Git Commit.
  // Step to create commit:
  // - Fetch main branch tree last commit SHA ref
  // - Build new tree by adding new tree node on top of main branch last commit SHA
  // - Create Commit based on the newly created tree
  // = Push new commit SHA as main branch latest ref
  const treeEntries: Array<TreeEntry | null> = [
    {
      path: `src/content/blog/${input.slug}.mdx`,
      mode: "100644", // Non-executable file
      type: "blob",
      sha: mdx.sha,
    },
    image && {
      path: imagePath,
      mode: "100644",
      type: "blob",
      sha: image.sha,
    },
  ];

  const treeResp = await ghApi("/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSHA,
      tree: treeEntries.filter((v) => v && v !== null),
    }),
  });
  const newTree = (await treeResp.json()) as { sha: string };

  const title = `content: new content push from admin panel - ${input.slug} - ${crypto.randomUUID().split("-").pop()}`;

  const newCommitResp = await ghApi("/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `Edit: ${title}`,
      tree: newTree.sha,
      parents: [headSHA],
    }),
  });

  const newCommit = (await newCommitResp.json()) as { sha: string };

  await ghApi("/refs/heads/main", {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return { ok: true };
}
