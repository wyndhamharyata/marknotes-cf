# Triggering SSG Rebuilds via GitHub Actions Webhook

## Overview

Use **GitHub Actions + repository_dispatch** to trigger rebuilds when content is published from the CMS.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Webhook Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. User clicks "Publish" in CMS                                        │
│                    │                                                     │
│                    ▼                                                     │
│   2. CMS saves content to Turso database                                 │
│                    │                                                     │
│                    ▼                                                     │
│   3. CMS calls GitHub API (repository_dispatch)                          │
│                    │                                                     │
│      POST https://api.github.com/repos/{owner}/{repo}/dispatches         │
│      Authorization: Bearer {GITHUB_TOKEN}                                │
│      { "event_type": "cms-publish" }                                     │
│                    │                                                     │
│                    ▼                                                     │
│   4. GitHub Actions workflow triggers                                    │
│                    │                                                     │
│                    ▼                                                     │
│   5. Workflow runs: npm install → sst deploy --stage production          │
│                    │                                                     │
│                    ▼                                                     │
│   6. SST builds Astro → deploys to Cloudflare Workers (~2-3 min)         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. GitHub Actions Workflow

**Create file:** `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  # Manual trigger from GitHub UI
  workflow_dispatch:

  # Webhook trigger from CMS
  repository_dispatch:
    types: [cms-publish]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy with SST
        run: npx sst deploy --stage production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_DEFAULT_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_DEFAULT_ACCOUNT_ID }}
          LIBSQL_URL: ${{ secrets.LIBSQL_URL }}
          LIBSQL_AUTH_TOKEN: ${{ secrets.LIBSQL_AUTH_TOKEN }}
```

---

## 2. GitHub Actions Secrets

Add these secrets to your repository:

1. Go to **GitHub → marknotes-cf → Settings → Secrets and variables → Actions**
2. Add the following repository secrets:

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_DEFAULT_ACCOUNT_ID` | Your Cloudflare account ID |
| `LIBSQL_URL` | Your Turso database URL |
| `LIBSQL_AUTH_TOKEN` | Your Turso auth token |

---

## 3. GitHub Token for CMS

The CMS needs a **GitHub Personal Access Token (PAT)** to trigger workflows.

### Creating the Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Token name:** `CMS Deploy Trigger`
   - **Expiration:** Choose based on your preference
   - **Repository access:** Select `marknotes-cf` only
   - **Permissions → Repository permissions → Contents:** Read and write
4. Click **Generate token** and copy it

Store as `GITHUB_TOKEN` in your CMS environment.

---

## 4. CMS Publish Function

```typescript
// In your CMS backend
async function onPublish(postId: string) {
  // 1. Save content to Turso
  await db.execute({
    sql: `UPDATE posts SET status = 'published', published_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), postId],
  });

  // 2. Trigger GitHub Actions rebuild
  const response = await fetch(
    'https://api.github.com/repos/wyndhamharyata/marknotes-cf/dispatches',
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: 'cms-publish',
        client_payload: {
          postId,
          timestamp: new Date().toISOString(),
        },
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to trigger rebuild:', response.status);
    return {
      published: true,
      rebuildTriggered: false,
      message: 'Published, but rebuild failed. Try again later.',
    };
  }

  return {
    published: true,
    rebuildTriggered: true,
    message: 'Published! Site will update in ~2-3 minutes.',
  };
}
```

---

## Implementation Checklist

- [ ] Create `.github/workflows/deploy.yml` with the workflow above
- [ ] Add GitHub Actions secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_DEFAULT_ACCOUNT_ID, LIBSQL_URL, LIBSQL_AUTH_TOKEN)
- [ ] Create GitHub PAT with repo access for CMS
- [ ] Add `GITHUB_TOKEN` to CMS environment
- [ ] Implement publish function in CMS that calls GitHub API
- [ ] Test by manually triggering workflow from GitHub UI (`workflow_dispatch`)
- [ ] Test CMS publish → verify rebuild triggers

---

## Trade-offs

| Aspect | GitHub Actions Approach |
|--------|------------------------|
| **Rebuild time** | ~2-3 minutes (includes npm install) |
| **Complexity** | Low - just a workflow file |
| **Cost** | Free for public repos, 2000 min/month for private |
| **Reliability** | High - GitHub Actions is very stable |
| **Debugging** | Easy - full logs in GitHub UI |
