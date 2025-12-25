# Triggering Astro SSG Rebuilds from a CMS

A focused guide on how a CMS can trigger static site regeneration in Astro when content is published.

---

## The Core Problem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        The SSG Update Challenge                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   CMS (any system)              Astro SSG                               │
│   ┌─────────────────┐           ┌─────────────────────────────────────┐ │
│   │  User publishes │           │  Static HTML built at deploy time   │ │
│   │  new content    │──── ? ───▶│  Content is "frozen" until rebuild  │ │
│   └─────────────────┘           └─────────────────────────────────────┘ │
│                                                                         │
│   How does new content get from the CMS to the static site?             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Astro SSG loads content at build time**, not request time. When you update content in your database, the static site doesn't reflect it until you rebuild.

---

## Solution: Deploy Hooks

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Deploy Hook Flow                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. User clicks "Publish" in CMS                                       │
│                    │                                                    │
│                    ▼                                                    │
│   2. CMS saves content to database (Turso)                              │
│                    │                                                    │
│                    ▼                                                    │
│   3. CMS calls webhook URL (HTTP POST)                                  │
│                    │                                                    │
│      POST https://api.cloudflare.com/pages/webhooks/deploy/xxx          │
│                    │                                                    │
│                    ▼                                                    │
│   4. Cloudflare Pages triggers new build                                │
│                    │                                                    │
│                    ▼                                                    │
│   5. Astro build runs, content loader fetches from Turso                │
│                    │                                                    │
│                    ▼                                                    │
│   6. New static files deployed to edge (~1-3 minutes total)             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Setting Up Deploy Hooks

### Cloudflare Pages

1. Go to **Cloudflare Dashboard → Pages → Your Project**
2. Navigate to **Settings → Builds & Deployments**
3. Scroll to **Deploy Hooks**
4. Click **Add deploy hook**
5. Give it a name (e.g., "CMS Publish")
6. Copy the generated webhook URL

The URL looks like:
```
https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/xxxxxxxx
```

### Other Platforms

**Vercel:**
- Project Settings → Git → Deploy Hooks
- URL format: `https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy`

**Netlify:**
- Site Settings → Build & deploy → Build hooks
- URL format: `https://api.netlify.com/build_hooks/xxx`

---

## Calling the Hook from Your CMS

### Basic Implementation

```typescript
// When "Publish" is clicked in your CMS
async function onPublish(postId: string) {
  // 1. Save content to database
  await savePost(postId, { status: "published" });

  // 2. Trigger site rebuild
  const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;

  const response = await fetch(webhookUrl, {
    method: "POST",
    // No body needed - the POST request itself triggers the build
  });

  if (!response.ok) {
    throw new Error("Failed to trigger rebuild");
  }

  // 3. Return success
  return {
    message: "Published! Site will update in ~2 minutes."
  };
}
```

### With Error Handling

```typescript
async function publishAndRebuild(postId: string, content: PostContent) {
  const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;

  if (!webhookUrl) {
    throw new Error("Deploy hook not configured");
  }

  // Save to database first
  try {
    await db.execute({
      sql: `UPDATE posts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), new Date().toISOString(), postId],
    });
  } catch (dbError) {
    throw new Error(`Database error: ${dbError.message}`);
  }

  // Then trigger rebuild
  try {
    const response = await fetch(webhookUrl, { method: "POST" });

    if (!response.ok) {
      // Log but don't fail - content is saved, rebuild can be retried
      console.error("Rebuild trigger failed:", response.status);
      return {
        published: true,
        rebuildTriggered: false,
        message: "Published, but rebuild failed. Content will update on next deploy.",
      };
    }

    return {
      published: true,
      rebuildTriggered: true,
      message: "Published! Site will update in ~2 minutes.",
    };
  } catch (fetchError) {
    console.error("Rebuild trigger error:", fetchError);
    return {
      published: true,
      rebuildTriggered: false,
      message: "Published, but couldn't trigger rebuild.",
    };
  }
}
```

---

## Environment Setup

### Required Environment Variables

```bash
# .env (local development)
CLOUDFLARE_DEPLOY_HOOK=https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/xxx
```

### SST Configuration

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "marknotes-cf",
      home: "cloudflare",
      providers: { cloudflare: "6.11.0" },
    };
  },
  async run() {
    const site = new sst.cloudflare.Astro("Max", {
      domain: $app.stage === "production"
        ? "read.mwyndham.dev"
        : "devread.mwyndham.dev",
      environment: {
        LIBSQL_URL: process.env.LIBSQL_URL,
        LIBSQL_AUTH_TOKEN: process.env.LIBSQL_AUTH_TOKEN,
        // Don't expose deploy hook to client - keep server-side only
      },
    });

    return { url: site.url };
  },
});
```

---

## Implementation Checklist

- [ ] Create deploy hook in Cloudflare Pages dashboard
- [ ] Store webhook URL as environment variable (server-side only)
- [ ] Implement publish function that saves to DB then triggers hook
- [ ] Add error handling for failed rebuild triggers
- [ ] Show user feedback about rebuild status
