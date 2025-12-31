# Building a Custom CMS with Astro & Cloudflare R2

A comprehensive learning guide for creating an in-house CMS that integrates with Astro's content system and triggers static generation.

---

## Table of Contents

1. [Understanding the Architecture](#1-understanding-the-architecture)
2. [Setting Up Cloudflare R2 with SST](#2-setting-up-cloudflare-r2-with-sst)
3. [Creating a Custom Content Loader](#3-creating-a-custom-content-loader)
4. [Building the CMS Admin Interface](#4-building-the-cms-admin-interface)
5. [Implementing the Editor](#5-implementing-the-editor)
6. [Triggering Static Generation](#6-triggering-static-generation)
7. [Deployment Strategies](#7-deployment-strategies)
8. [Trade-offs & Considerations](#8-trade-offs--considerations)

---

## 1. Understanding the Architecture

### Current Setup (Your Project)

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Current Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   src/content/blog/*.md  ───▶  Astro Build  ───▶  Cloudflare │
│         (local files)           (glob loader)      Workers   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Target Architecture                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐      ┌─────────────┐      ┌───────────────────────┐  │
│   │  CMS Admin   │      │ Cloudflare  │      │     Astro Site        │  │
│   │  (SSR Pages) │─────▶│     R2      │─────▶│  (Custom R2 Loader)   │  │
│   │  /admin/*    │      │  (Storage)  │      │                       │  │
│   └──────────────┘      └─────────────┘      └───────────────────────┘  │
│          │                     │                        │               │
│          │                     │                        ▼               │
│          │              Webhook/API ──────────▶  Deploy Hook or         │
│          │                                       Cache Invalidation     │
│          ▼                                                              │
│   Authentication                                                        │
│   (Cloudflare Access / Custom)                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept              | Explanation                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **Content Loader**   | A function that fetches content from any source and normalizes it for Astro's content collections API |
| **R2**               | Cloudflare's S3-compatible object storage, zero egress fees when accessed from Workers                |
| **Hybrid Rendering** | Mix of static (prerendered) and dynamic (SSR) pages in one Astro app                                  |
| **Deploy Hook**      | A webhook URL that triggers a new deployment/build when called                                        |

---

## 2. Setting Up Cloudflare R2 with SST

### Step 2.1: Add R2 Bucket to SST Config

Your current `sst.config.ts` only defines the Astro site. You'll add an R2 bucket:

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "marknotes-cf",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: { cloudflare: "6.11.0" },
    };
  },
  async run() {
    // NEW: Create R2 bucket for content storage
    const contentBucket = new sst.cloudflare.Bucket("ContentBucket", {
      // Optional: Enable access from the web (for public images)
      // transform: {
      //   bucket: { ... }
      // }
    });

    // Your Astro site with R2 binding
    const site = new sst.cloudflare.Astro("Max", {
      domain: $app.stage === "production" ? "read.mwyndham.dev" : "devread.mwyndham.dev",
      // Link the bucket so your Astro app can access it
      link: [contentBucket],
    });

    return {
      siteUrl: site.url,
      bucketName: contentBucket.name,
    };
  },
});
```

### Step 2.2: Understanding SST Resource Linking

When you `link` a resource in SST, it:

1. Creates the necessary Cloudflare bindings
2. Generates TypeScript types in `sst-env.d.ts`
3. Makes the resource accessible via `Resource.ContentBucket`

After running `sst dev` or `sst deploy`, your `sst-env.d.ts` will include:

```typescript
declare module "sst" {
  export interface Resource {
    ContentBucket: {
      type: "sst.cloudflare.Bucket";
      name: string;
    };
    Max: {
      type: "sst.cloudflare.Astro";
      url: string;
    };
  }
}
```

### Step 2.3: Accessing R2 from Your Astro App

In Cloudflare Workers (which powers your Astro SSR), R2 is accessed through **bindings**, not HTTP:

```typescript
// src/lib/r2.ts
import { Resource } from "sst";

// In Cloudflare Workers environment
export async function getR2Bucket(runtime: Runtime) {
  // The binding name comes from SST's linking
  const bucket = runtime.env[Resource.ContentBucket.name];
  return bucket;
}

// List all markdown files
export async function listPosts(bucket: R2Bucket) {
  const listed = await bucket.list({ prefix: "posts/" });
  return listed.objects;
}

// Get a single post
export async function getPost(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  if (!object) return null;
  return await object.text();
}

// Save a post
export async function savePost(bucket: R2Bucket, key: string, content: string) {
  await bucket.put(key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });
}
```

### Why R2 Over Other Options?

| Feature                  | R2            | S3             | Database  |
| ------------------------ | ------------- | -------------- | --------- |
| Egress cost from Workers | **Free**      | Paid           | Varies    |
| Latency from Workers     | **~1-5ms**    | 50-200ms       | 10-50ms   |
| Native binding support   | **Yes**       | No (need HTTP) | Some (D1) |
| File versioning          | Optional      | Yes            | Manual    |
| Good for markdown files  | **Excellent** | Good           | Awkward   |

---

## 3. Creating a Custom Content Loader

### Step 3.1: Understanding the Loader API

A content loader is a function that Astro calls at **build time** (or dev server start) to populate a collection. The loader receives a `context` object with these key tools:

```typescript
interface LoaderContext {
  // Store entries in Astro's content layer
  store: DataStore;

  // Validate data against your schema
  parseData: (options: { id: string; data: unknown }) => Promise<TData>;

  // Convert markdown string to rendered HTML
  renderMarkdown: (content: string) => Promise<RenderedContent>;

  // Create a hash for change detection
  generateDigest: (data: unknown) => string;

  // Persist metadata between builds (sync tokens, timestamps)
  meta: MetaStore;

  // Logger with loader name prefix
  logger: AstroLogger;
}
```

### Step 3.2: Build the R2 Loader

Create a new file for your custom loader:

```typescript
// src/lib/r2-loader.ts
import type { Loader, LoaderContext } from "astro/loaders";
import { z } from "astro:content";

// Define what configuration your loader accepts
interface R2LoaderConfig {
  bucketBinding: string; // The R2 binding name
  prefix?: string; // Folder prefix in bucket (e.g., "posts/")
}

// The loader factory function
export function r2Loader(config: R2LoaderConfig): Loader {
  return {
    name: "r2-markdown-loader",

    async load(context: LoaderContext) {
      const { store, parseData, renderMarkdown, generateDigest, logger } = context;

      // IMPORTANT: In Cloudflare Workers, you access R2 via env bindings
      // However, at BUILD TIME, Astro runs in Node.js, not Workers!
      //
      // This is a critical architectural decision point:
      //
      // Option A: Use R2's S3-compatible API with credentials (works at build time)
      // Option B: Skip custom loader, use SSR to fetch from R2 at request time
      // Option C: Use a "sync" script that downloads R2 → local files before build

      // For this example, we'll use Option A (S3-compatible API)
      const { S3Client, ListObjectsV2Command, GetObjectCommand } =
        await import("@aws-sdk/client-s3");

      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });

      // List all markdown files in the bucket
      const listResponse = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME,
          Prefix: config.prefix || "",
        })
      );

      const files =
        listResponse.Contents?.filter(
          (obj) => obj.Key?.endsWith(".md") || obj.Key?.endsWith(".mdx")
        ) || [];

      logger.info(`Found ${files.length} markdown files in R2`);

      // Process each file
      for (const file of files) {
        if (!file.Key) continue;

        // Fetch the file content
        const getResponse = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.Key,
          })
        );

        const content = await getResponse.Body?.transformToString();
        if (!content) continue;

        // Parse frontmatter and body
        const { frontmatter, body } = parseFrontmatter(content);

        // Generate a unique ID from the filename
        const id = file.Key.replace(config.prefix || "", "").replace(/\.(md|mdx)$/, "");

        // Create digest for caching
        const digest = generateDigest(content);

        // Validate frontmatter against schema
        const data = await parseData({
          id,
          data: frontmatter,
        });

        // Render markdown to HTML
        const rendered = await renderMarkdown(body);

        // Store the entry
        store.set({
          id,
          data,
          body,
          rendered,
          digest,
        });

        logger.debug(`Loaded: ${id}`);
      }

      logger.info(`Successfully loaded ${files.length} posts from R2`);
    },
  };
}

// Simple frontmatter parser
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, frontmatterStr, body] = match;

  // Parse YAML frontmatter (you'd use a proper YAML parser in production)
  const frontmatter: Record<string, unknown> = {};
  for (const line of frontmatterStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if (typeof value === "string" && value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}
```

### Step 3.3: Register the Loader in Content Config

Update your content configuration to use the R2 loader:

```typescript
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { r2Loader } from "./lib/r2-loader";

// Keep your existing local collection for development
const localBlog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
    }),
});

// New R2-based collection for production
const r2Blog = defineCollection({
  loader: r2Loader({
    bucketBinding: "CONTENT_BUCKET",
    prefix: "posts/",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(), // URL string instead of image()
  }),
});

// Choose collection based on environment
const isProduction = import.meta.env.PROD;

export const collections = {
  blog: isProduction ? r2Blog : localBlog,
};
```

### The Build-Time vs. Runtime Problem

This is **the most important concept** to understand:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    When Does Code Run?                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BUILD TIME (Node.js on your machine or CI)                             │
│  ├── Content loaders execute                                            │
│  ├── Static pages are pre-rendered                                      │
│  ├── NO access to Cloudflare bindings (R2, KV, D1)                     │
│  └── Must use HTTP APIs with credentials                                │
│                                                                          │
│  REQUEST TIME (Cloudflare Workers)                                      │
│  ├── SSR pages render                                                   │
│  ├── API routes execute                                                 │
│  ├── HAS access to Cloudflare bindings (fast, free egress)             │
│  └── Can read/write R2 directly                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**This means:**

- Your **CMS admin panel** (SSR) can use R2 bindings directly (fast!)
- Your **content loader** (build time) must use S3-compatible HTTP API (requires credentials)
- Alternative: Use full SSR for blog pages too, skip the loader entirely

---

## 4. Building the CMS Admin Interface

### Step 4.1: Create the Admin Route Structure

```
src/pages/
├── admin/
│   ├── index.astro          # Dashboard
│   ├── posts/
│   │   ├── index.astro      # Post list
│   │   ├── new.astro        # Create new post
│   │   └── [id].astro       # Edit existing post
│   └── api/
│       ├── posts.ts         # CRUD API endpoints
│       └── publish.ts       # Trigger rebuild
└── blog/
    └── [...slug].astro      # Public blog (existing)
```

### Step 4.2: Make Admin Routes Server-Rendered

```typescript
// src/pages/admin/index.astro
---
// This line is CRITICAL - it prevents this page from being pre-rendered
// Without it, your admin page would be static HTML with no dynamic functionality
export const prerender = false;

import AdminLayout from "../../layouts/AdminLayout.astro";
import { getRuntime } from "@astrojs/cloudflare/runtime";

// Get the Cloudflare runtime to access bindings
const runtime = getRuntime(Astro.request);

// Access R2 bucket via binding (fast, no credentials needed)
const bucket = runtime.env.CONTENT_BUCKET;

// List recent posts
const listed = await bucket.list({ prefix: "posts/", limit: 10 });
const recentPosts = listed.objects;
---
<AdminLayout title="Dashboard">
  <h1 class="text-2xl font-bold mb-6">Content Dashboard</h1>

  <div class="stats shadow mb-8">
    <div class="stat">
      <div class="stat-title">Total Posts</div>
      <div class="stat-value">{recentPosts.length}</div>
    </div>
  </div>

  <h2 class="text-xl font-semibold mb-4">Recent Posts</h2>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Last Modified</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {recentPosts.map((post) => (
          <tr>
            <td>{post.key.replace("posts/", "").replace(".md", "")}</td>
            <td>{post.uploaded.toLocaleDateString()}</td>
            <td>
              <a href={`/admin/posts/${post.key}`} class="btn btn-sm">
                Edit
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</AdminLayout>
```

### Step 4.3: Create API Routes for CRUD Operations

```typescript
// src/pages/admin/api/posts.ts
import type { APIRoute } from "astro";
import { getRuntime } from "@astrojs/cloudflare/runtime";

// Prevent pre-rendering of API routes
export const prerender = false;

// GET: List all posts or get single post
export const GET: APIRoute = async ({ request, url }) => {
  const runtime = getRuntime(request);
  const bucket = runtime.env.CONTENT_BUCKET;

  const id = url.searchParams.get("id");

  if (id) {
    // Get single post
    const object = await bucket.get(`posts/${id}.md`);
    if (!object) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const content = await object.text();
    return new Response(JSON.stringify({ id, content }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // List all posts
  const listed = await bucket.list({ prefix: "posts/" });
  const posts = listed.objects.map((obj) => ({
    id: obj.key.replace("posts/", "").replace(".md", ""),
    key: obj.key,
    uploaded: obj.uploaded,
    size: obj.size,
  }));

  return new Response(JSON.stringify(posts), {
    headers: { "Content-Type": "application/json" },
  });
};

// POST: Create new post
export const POST: APIRoute = async ({ request }) => {
  const runtime = getRuntime(request);
  const bucket = runtime.env.CONTENT_BUCKET;

  const body = await request.json();
  const { id, content } = body;

  if (!id || !content) {
    return new Response(JSON.stringify({ error: "Missing id or content" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if already exists
  const existing = await bucket.head(`posts/${id}.md`);
  if (existing) {
    return new Response(JSON.stringify({ error: "Post already exists" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  await bucket.put(`posts/${id}.md`, content, {
    httpMetadata: { contentType: "text/markdown" },
  });

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

// PUT: Update existing post
export const PUT: APIRoute = async ({ request }) => {
  const runtime = getRuntime(request);
  const bucket = runtime.env.CONTENT_BUCKET;

  const body = await request.json();
  const { id, content } = body;

  await bucket.put(`posts/${id}.md`, content, {
    httpMetadata: { contentType: "text/markdown" },
  });

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { "Content-Type": "application/json" },
  });
};

// DELETE: Remove post
export const DELETE: APIRoute = async ({ request, url }) => {
  const runtime = getRuntime(request);
  const bucket = runtime.env.CONTENT_BUCKET;

  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await bucket.delete(`posts/${id}.md`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

### Step 4.4: Add Authentication

For a production CMS, you **must** protect admin routes. Options:

**Option A: Cloudflare Access (Recommended)**

Cloudflare Access is a zero-trust security layer that sits in front of your app:

```typescript
// sst.config.ts - Conceptual (Access is configured in Cloudflare Dashboard)
// You would configure Access to protect /admin/* routes

// In your admin pages, verify the JWT:
// src/middleware.ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith("/admin")) {
    // Cloudflare Access adds these headers
    const cfAccessJWT = context.request.headers.get("Cf-Access-Jwt-Assertion");

    if (!cfAccessJWT) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify JWT with Cloudflare's public keys
    // (implementation details omitted for brevity)
  }

  return next();
});
```

**Option B: Simple Password Protection**

For development or simple use cases:

```typescript
// src/middleware.ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith("/admin")) {
    const auth = context.request.headers.get("Authorization");

    if (!auth || auth !== `Bearer ${import.meta.env.ADMIN_TOKEN}`) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }
  }

  return next();
});
```

---

## 5. Implementing the Editor

### Step 5.1: Editor Page Structure

```typescript
// src/pages/admin/posts/[id].astro
---
export const prerender = false;

import AdminLayout from "../../../layouts/AdminLayout.astro";
import { getRuntime } from "@astrojs/cloudflare/runtime";

const { id } = Astro.params;
const runtime = getRuntime(Astro.request);
const bucket = runtime.env.CONTENT_BUCKET;

// Fetch existing post content
let content = "";
let isNew = false;

if (id === "new") {
  isNew = true;
  content = `---
title: "New Post"
description: "Post description"
pubDate: "${new Date().toISOString().split("T")[0]}"
---

Write your content here...
`;
} else {
  const object = await bucket.get(`posts/${id}.md`);
  if (object) {
    content = await object.text();
  }
}
---
<AdminLayout title={isNew ? "New Post" : `Edit: ${id}`}>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">
      {isNew ? "Create New Post" : `Editing: ${id}`}
    </h1>

    <!-- Editor Container -->
    <div id="editor-root"
         data-post-id={id}
         data-content={content}
         data-is-new={isNew}>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-4 mt-6">
      <button id="save-btn" class="btn btn-primary">
        Save Draft
      </button>
      <button id="publish-btn" class="btn btn-success">
        Save & Publish
      </button>
      <a href="/admin/posts" class="btn btn-ghost">
        Cancel
      </a>
    </div>
  </div>

  <!-- Client-side JavaScript for editor -->
  <script>
    const root = document.getElementById("editor-root");
    const postId = root?.dataset.postId;
    const initialContent = root?.dataset.content || "";
    const isNew = root?.dataset.isNew === "true";

    // Simple textarea editor (replace with Monaco, CodeMirror, etc.)
    const textarea = document.createElement("textarea");
    textarea.className = "textarea textarea-bordered w-full h-96 font-mono";
    textarea.value = initialContent;
    root?.appendChild(textarea);

    // Save functionality
    document.getElementById("save-btn")?.addEventListener("click", async () => {
      const content = textarea.value;
      const method = isNew ? "POST" : "PUT";
      const id = isNew ? prompt("Enter post slug:") : postId;

      const response = await fetch("/admin/api/posts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });

      if (response.ok) {
        alert("Saved!");
        if (isNew) {
          window.location.href = `/admin/posts/${id}`;
        }
      } else {
        alert("Error saving");
      }
    });

    // Publish functionality (save + trigger rebuild)
    document.getElementById("publish-btn")?.addEventListener("click", async () => {
      // First save
      const content = textarea.value;
      const method = isNew ? "POST" : "PUT";
      const id = isNew ? prompt("Enter post slug:") : postId;

      await fetch("/admin/api/posts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });

      // Then trigger rebuild
      const publishResponse = await fetch("/admin/api/publish", {
        method: "POST",
      });

      if (publishResponse.ok) {
        alert("Published! Site will rebuild shortly.");
      }
    });
  </script>
</AdminLayout>
```

### Step 5.2: Rich Markdown Editors

For a better editing experience, consider these libraries:

| Library           | Pros                                     | Cons                     |
| ----------------- | ---------------------------------------- | ------------------------ |
| **Monaco Editor** | VSCode-like, great syntax highlighting   | Large bundle size (~2MB) |
| **CodeMirror 6**  | Lightweight, extensible, mobile-friendly | Steeper learning curve   |
| **Milkdown**      | WYSIWYG markdown, plugin system          | Newer, smaller community |
| **Tiptap**        | Rich text with markdown export           | Not pure markdown        |

Example with a WYSIWYG library (Milkdown):

```typescript
// src/components/MarkdownEditor.tsx (React island)
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { commonmark } from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";

export function MarkdownEditor({
  initialContent,
  onChange
}: {
  initialContent: string;
  onChange: (markdown: string) => void;
}) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
      })
      .use(commonmark)
      .use(history)
  );

  return (
    <MilkdownProvider>
      <Milkdown />
    </MilkdownProvider>
  );
}
```

---

## 6. Triggering Static Generation

This is the key to getting updated content onto your static site.

### Option A: Deploy Hooks (Simplest)

Most platforms provide webhook URLs that trigger a rebuild:

```typescript
// src/pages/admin/api/publish.ts
import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Cloudflare Pages deploy hook
  // Get this URL from: Cloudflare Dashboard → Pages → Settings → Builds & Deployments
  const deployHookUrl = import.meta.env.CLOUDFLARE_DEPLOY_HOOK;

  if (!deployHookUrl) {
    return new Response(JSON.stringify({ error: "Deploy hook not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Trigger the rebuild
  const response = await fetch(deployHookUrl, { method: "POST" });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: "Deploy hook failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Build triggered",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};
```

### Option B: SSR Blog Pages (No Rebuild Needed)

If you don't want to rebuild for every change, serve blog pages dynamically:

```typescript
// src/pages/blog/[...slug].astro
---
// Change from prerender = true to false
export const prerender = false;

import { getRuntime } from "@astrojs/cloudflare/runtime";
import BlogPost from "../../layouts/BlogPost.astro";
import { marked } from "marked"; // Or use Astro's renderMarkdown

const { slug } = Astro.params;
const runtime = getRuntime(Astro.request);
const bucket = runtime.env.CONTENT_BUCKET;

// Fetch post from R2
const object = await bucket.get(`posts/${slug}.md`);
if (!object) {
  return Astro.redirect("/404");
}

const content = await object.text();
const { frontmatter, body } = parseFrontmatter(content);
const html = marked(body);

// Set cache headers for edge caching
Astro.response.headers.set(
  "Cache-Control",
  "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400"
);
---
<BlogPost {...frontmatter}>
  <article class="prose" set:html={html} />
</BlogPost>
```

**Cache Header Explanation:**

- `max-age=60`: Browser caches for 1 minute
- `s-maxage=3600`: Edge (Cloudflare) caches for 1 hour
- `stale-while-revalidate=86400`: Serve stale content while fetching fresh (up to 24h)

### Option C: Cache Purge API

Purge specific URLs from Cloudflare's edge cache when content changes:

```typescript
// src/pages/admin/api/publish.ts
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { postId } = body;

  // Cloudflare API to purge cache
  const purgeResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          `https://read.mwyndham.dev/blog/${postId}`,
          `https://read.mwyndham.dev/blog/`, // Blog index
          `https://read.mwyndham.dev/rss.xml`,
        ],
      }),
    }
  );

  return new Response(JSON.stringify({ success: purgeResponse.ok }));
};
```

### Comparison of Approaches

| Approach    | Latency   | Cost           | Complexity | Best For           |
| ----------- | --------- | -------------- | ---------- | ------------------ |
| Deploy Hook | ~1-3 min  | Build minutes  | Low        | Infrequent updates |
| SSR + Cache | ~50-200ms | Compute time   | Medium     | Frequent updates   |
| Cache Purge | Instant   | API calls      | Medium     | Critical updates   |
| Full SSR    | ~50-200ms | Higher compute | Low        | Real-time content  |

---

## 7. Deployment Strategies

### Strategy 1: Separate Admin & Public Sites

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   admin.mwyndham.dev          read.mwyndham.dev             │
│   ┌─────────────────┐         ┌─────────────────┐           │
│   │  Astro SSR      │         │  Astro Static   │           │
│   │  (CMS Admin)    │────────▶│  (Blog)         │           │
│   │  output: server │ webhook │  output: static │           │
│   └─────────────────┘         └─────────────────┘           │
│           │                           ▲                      │
│           │                           │                      │
│           ▼                           │                      │
│   ┌─────────────────┐                 │                      │
│   │  Cloudflare R2  │─────────────────┘                      │
│   │  (Content)      │  (read at build time)                  │
│   └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Clean separation, blog is fully static (fastest)
**Cons:** Two deployments to manage

### Strategy 2: Single Hybrid App (Recommended for Your Case)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│              read.mwyndham.dev                               │
│   ┌─────────────────────────────────────────────┐           │
│   │              Astro Hybrid                    │           │
│   │  ┌─────────────┐    ┌─────────────────────┐ │           │
│   │  │ /admin/*    │    │ /blog/*             │ │           │
│   │  │ SSR         │    │ Prerendered         │ │           │
│   │  │ (dynamic)   │    │ (static at edge)    │ │           │
│   │  └─────────────┘    └─────────────────────┘ │           │
│   │         │                    ▲               │           │
│   │         ▼                    │               │           │
│   │  ┌───────────────────────────┴─────┐        │           │
│   │  │        Cloudflare R2            │        │           │
│   │  └─────────────────────────────────┘        │           │
│   └─────────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Single codebase, simpler deployment
**Cons:** Mixed rendering requires careful planning

### Your SST Config for Strategy 2

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "marknotes-cf",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: { cloudflare: "6.11.0" },
    };
  },
  async run() {
    // Content storage
    const contentBucket = new sst.cloudflare.Bucket("ContentBucket");

    // Your hybrid Astro site
    const site = new sst.cloudflare.Astro("Max", {
      domain: $app.stage === "production" ? "read.mwyndham.dev" : "devread.mwyndham.dev",
      link: [contentBucket],
      // Environment variables for build time
      environment: {
        R2_BUCKET_NAME: contentBucket.name,
        // These would come from secrets in production
        // R2_ACCESS_KEY_ID: "...",
        // R2_SECRET_ACCESS_KEY: "...",
      },
    });

    return {
      url: site.url,
      bucket: contentBucket.name,
    };
  },
});
```

---

## 8. Trade-offs & Considerations

### When to Use Each Approach

| Scenario                           | Recommended Approach          |
| ---------------------------------- | ----------------------------- |
| Personal blog, occasional posts    | SSG + Deploy hooks            |
| Multiple editors, frequent updates | SSR + Edge caching            |
| High traffic, SEO critical         | SSG for public, SSR for admin |
| Real-time collaboration            | Full SSR with WebSockets      |

### Performance Comparison

```
Request Latency (Time to First Byte):

Static (Edge Cached):     ~5-20ms   ████░░░░░░░░░░░░░░░░
SSR (Edge, Cached):       ~30-50ms  ██████████░░░░░░░░░░
SSR (Edge, Uncached):     ~50-150ms ████████████████░░░░
SSR (Origin):             ~200ms+   ████████████████████
```

### Cost Considerations (Cloudflare)

| Resource         | Free Tier                | Paid                         |
| ---------------- | ------------------------ | ---------------------------- |
| Workers requests | 100k/day                 | $0.50/million                |
| R2 storage       | 10GB                     | $0.015/GB/month              |
| R2 operations    | 10M Class A, 10M Class B | $4.50/million, $0.36/million |
| Pages builds     | 500/month                | Unlimited (Pro)              |

For a blog with ~10k monthly visitors, you'll likely stay in free tier.

### Security Checklist

- [ ] **Authentication**: Protect `/admin/*` routes
- [ ] **CSRF Protection**: Use tokens for state-changing operations
- [ ] **Input Validation**: Sanitize markdown/HTML to prevent XSS
- [ ] **Rate Limiting**: Prevent abuse of API endpoints
- [ ] **Secrets Management**: Use environment variables, never hardcode
- [ ] **Audit Logging**: Track who changed what and when

### What You Lose vs. Local Files

| Feature            | Local `.md`  | R2 Storage       |
| ------------------ | ------------ | ---------------- |
| Hot reload in dev  | ✅ Yes       | ❌ No            |
| MDX components     | ✅ Yes       | ⚠️ Limited       |
| Image optimization | ✅ Automatic | 🔧 Manual        |
| Git history        | ✅ Automatic | 🔧 Manual        |
| Instant preview    | ✅ Yes       | ⚠️ Requires save |

---

## Quick Start Checklist

1. [ ] Add R2 bucket to `sst.config.ts`
2. [ ] Create R2 credentials in Cloudflare Dashboard
3. [ ] Build custom content loader (or use SSR approach)
4. [ ] Create admin layout and routes
5. [ ] Implement CRUD API endpoints
6. [ ] Add authentication middleware
7. [ ] Set up deploy hook or cache invalidation
8. [ ] Test locally with `sst dev`
9. [ ] Deploy with `sst deploy`

---

## Further Reading

- [Astro Content Layer API](https://docs.astro.build/en/reference/content-loader-reference/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [SST Cloudflare Components](https://sst.dev/docs/component/cloudflare)
- [Cloudflare Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
