import { isSafeAssetKey, isSafeSlug, repoPathForAssetKey } from "./asset-key";

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

/** A staged R2 upload to be committed alongside the article. */
export interface CommitAsset {
  r2Key: string;
  buffer: ArrayBuffer;
}

export interface CommitInput {
  slug: string;
  mdxContent: string;
  assets?: CommitAsset[];
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export async function commitMdx(input: CommitInput): Promise<{ ok: boolean }> {
  const assets = input.assets ?? [];

  // These become repository paths a few lines down. The API route validates
  // them too, but this is the actual sink, so it re-checks rather than trusting
  // its callers.
  if (!isSafeSlug(input.slug)) throw new Error(`Unsafe slug: ${input.slug}`);
  for (const asset of assets) {
    if (!isSafeAssetKey(asset.r2Key)) throw new Error(`Unsafe asset key: ${asset.r2Key}`);
  }

  const lastHeadResp = await ghApi("/refs/heads/main");
  const ref = (await lastHeadResp.json()) as { object: { sha: string } };
  const headSHA = ref.object.sha;

  const baseCommitResp = await ghApi(`/commits/${headSHA}`);
  const baseCommit = (await baseCommitResp.json()) as { tree: { sha: string } };
  const baseTreeSHA = baseCommit.tree.sha;

  // GitHub Git Data API expects blobs as JSON with base64-encoded content.
  // Sending raw text or binary body with a non-JSON Content-Type causes 403.
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

  // Build Git Commit.
  // Step to create commit:
  // - Fetch main branch tree last commit SHA ref
  // - Build new tree by adding new tree node on top of main branch last commit SHA
  // - Create Commit based on the newly created tree
  // = Push new commit SHA as main branch latest ref
  const treeEntries: TreeEntry[] = [
    {
      path: `src/content/blog/${input.slug}.mdx`,
      mode: "100644", // Non-executable file
      type: "blob",
      sha: mdxSHA,
    },
    ...assets.map((asset, i) => ({
      path: repoPathForAssetKey(asset.r2Key),
      mode: "100644",
      type: "blob",
      sha: assetSHAs[i],
    })),
  ];

  const treeResp = await ghApi("/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSHA,
      tree: treeEntries,
    }),
  });
  const newTree = (await treeResp.json()) as { sha: string };

  const title = `content: new content push from admin panel - ${input.slug} - ${crypto.randomUUID().split("-").pop()}`;

  const newCommitResp = await ghApi("/commits", {
    method: "POST",
    body: JSON.stringify({
      message: title,
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

// btoa() only accepts a binary string, so bytes have to be widened to one
// first. Doing that a character at a time costs a string concatenation per
// byte, which is a real CPU-time risk on a Worker once a commit carries several
// megabytes of images; chunking keeps it to one concat per 32 KiB.
const BASE64_CHUNK_BYTES = 0x8000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}
