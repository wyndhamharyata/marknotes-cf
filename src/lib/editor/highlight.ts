import type { HighlighterCore } from "shiki/core";

/**
 * Syntax highlighting for the preview pane, matched to production.
 *
 * Astro renders published code blocks with Shiki's `github-dark`
 * (`class="astro-code github-dark"` in the built HTML), so the preview uses the
 * same highlighter and the same theme rather than an approximation.
 *
 * Built from `shiki/core` with an explicit language list instead of the full
 * bundle: the bundle's index references every grammar Shiki ships, which would
 * have Vite emit a chunk per language. Each entry below is a dynamic import, so
 * a grammar is only fetched the first time a code fence asks for it.
 *
 * The JavaScript regex engine avoids shipping the Oniguruma WASM binary;
 * `forgiving` lets it skip patterns it cannot compile rather than throwing.
 */
const THEME = "github-dark";

const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  astro: () => import("shiki/langs/astro.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  lua: () => import("shiki/langs/lua.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
};

const ALIASES: Record<string, string> = {
  bash: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  console: "shellscript",
  js: "javascript",
  ts: "typescript",
  md: "markdown",
  py: "python",
  rs: "rust",
  yml: "yaml",
  dockerfile: "docker",
  "c++": "cpp",
  golang: "go",
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();

async function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, theme] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("shiki/themes/github-dark.mjs"),
    ]);

    return createHighlighterCore({
      themes: [theme.default],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  })();

  return highlighterPromise;
}

/** Null for anything we have no grammar for — `dirtree` and `templ` both appear in existing posts. */
function resolveLanguage(lang: string): string | null {
  const key = lang.trim().toLowerCase();
  const resolved = ALIASES[key] ?? key;
  return resolved in LANGUAGE_LOADERS ? resolved : null;
}

/** Highlighted `<pre>` markup, or null to let the caller render plain. */
export async function highlightCode(
  code: string,
  lang: string | undefined
): Promise<string | null> {
  if (!lang) return null;

  const resolved = resolveLanguage(lang);
  if (!resolved) return null;

  try {
    const highlighter = await getHighlighter();

    if (!loadedLanguages.has(resolved)) {
      const grammar = (await LANGUAGE_LOADERS[resolved]()) as { default: unknown };
      await highlighter.loadLanguage(grammar.default as never);
      loadedLanguages.add(resolved);
    }

    return highlighter.codeToHtml(code, { lang: resolved, theme: THEME });
  } catch {
    // A grammar the JS engine cannot handle should degrade to plain text, not
    // take the whole preview down.
    return null;
  }
}
