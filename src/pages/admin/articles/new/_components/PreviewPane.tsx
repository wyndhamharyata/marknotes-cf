import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { renderPreview } from "../../../../../lib/editor/preview-render";
import type { InlineAsset } from "../../../../../lib/editor/types";

interface Props {
  body: string;
  assets: InlineAsset[];
  proseClass: string;
  title: string;
  pubDate: string;
  /** The hero picker, rendered where the real article puts its hero image. */
  hero: ComponentChildren;
}

/** Long enough to skip a burst of keystrokes, short enough to feel live. */
const RENDER_DEBOUNCE_MS = 200;

/** Mirrors the structure of BlogPost.astro: hero, date, title, divider, prose. */
export default function PreviewPane({ body, assets, proseClass, title, pubDate, hero }: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      renderPreview(body, assets)
        .then((rendered) => {
          if (!cancelled) setHtml(rendered);
        })
        .catch((error) => {
          if (!cancelled) setHtml(`<p class="text-error">Preview failed: ${error}</p>`);
        });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [body, assets]);

  return (
    <div class="h-full min-h-[60vh] overflow-y-auto md:min-h-0">
      {hero}

      <div class="p-4 md:p-6">
        <div class="mb-6 text-center">
          <p class="text-base-content/70 mb-2">{pubDate}</p>
          <h1 class="justify-center text-3xl font-extrabold md:text-4xl">{title}</h1>
          <div class="divider" />
        </div>

        {body.trim() ? (
          <div class={proseClass} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p class="text-base-content/50 text-center text-sm">Preview appears as you type.</p>
        )}
      </div>
    </div>
  );
}
