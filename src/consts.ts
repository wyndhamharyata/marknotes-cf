export const SITE_TITLE = `Wyndham's Blog`;
export const SITE_DESCRIPTION = "Blog by Wyndham Haryata";

// Must stay one static literal or Tailwind's scanner misses these classes.
export const ARTICLE_PROSE_CLASS =
  "prose article-prose [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol_ol]:list-[decimal]";

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
