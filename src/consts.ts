// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = `Wyndham's Blog`;
export const SITE_DESCRIPTION = "Blog by Wyndham Haryata";

/**
 * Typography for rendered article bodies, shared by the public post layout, the
 * admin article view, and the editor preview so all three stay in agreement.
 *
 * Keep this a single static string literal: Tailwind scans source text, so a
 * dynamically assembled class list would silently drop these utilities from the
 * generated CSS.
 *
 * The nested `ol` rules give ordered lists a different marker per depth
 * (1. → a. → i.), the way a word processor does. Markdown itself cannot express
 * this — a fence only ever holds digits — so the depth styling has to live in
 * CSS while the source stays numeric.
 */
export const ARTICLE_PROSE_CLASS =
  "prose prose-slate lg:prose-xl md:prose-lg dark:prose-invert prose-pre:bg-slate-900 prose-em:text-secondary prose-strong:text-primary prose-strong:font-extrabold prose-a:font-extrabold prose-a:text-accent prose-a:brightness-90 prose-strong:brightness-50 prose-em:brightness-50 dark:prose-a:brightness-100 dark:prose-strong:brightness-100 dark:prose-em:brightness-100 [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol_ol]:list-[decimal] mx-auto w-full";

export const ADMIN_DOCK = [
  {
    path: "/admin",
    iconName: "heroicons:home",
    label: "Home",
  },
  {
    path: "/admin/articles",
    iconName: "heroicons:document-text",
    label: "Articles",
  },
  {
    path: "/admin/comments",
    iconName: "heroicons:chat-bubble-left",
    label: "Comments",
  },
];
