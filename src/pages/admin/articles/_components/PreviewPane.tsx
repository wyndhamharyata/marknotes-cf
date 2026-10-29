import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren, RefObject } from "preact";
import { renderPreview } from "../../../../lib/editor/preview-render";
import type { InlineAsset } from "../../../../lib/editor/types";
import type { KopimapShop } from "../../../../lib/kopimap";
import ShopBlock from "../../../../components/ShopBlock";
import { formatDate } from "../../../../lib/date";

interface Props {
  body: string;
  assets: InlineAsset[];
  proseClass: string;
  title: string;
  pubDate: string;
  /** The hero picker, rendered where the real article puts its hero image. */
  hero: ComponentChildren;
  /** Owned by MdxEditor so it can drive scroll sync against the textarea. */
  scrollRef: RefObject<HTMLDivElement>;
  /** The pane's share of the split, set by MdxEditor's divider. */
  style?: Record<string, string>;
  shop?: KopimapShop;
  rating?: number;
}

/** Long enough to skip a burst of keystrokes, short enough to feel live. */
const RENDER_DEBOUNCE_MS = 200;

/** Mirrors BlogPost.astro: the sheet with its hero, headline, dateline, ticket and prose. */
export default function PreviewPane({
  body,
  assets,
  proseClass,
  title,
  pubDate,
  hero,
  scrollRef,
  style,
  shop,
  rating,
}: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      renderPreview(body, assets)
        .then((rendered) => {
          if (!cancelled) setHtml(rendered);
        })
        .catch((error) => {
          if (!cancelled) setHtml(`<p class="err">Preview failed: ${error}</p>`);
        });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [body, assets]);

  const date = new Date(pubDate);

  return (
    <div ref={scrollRef} class="editor-preview" style={style}>
      <article class="sheet article">
        {hero}
        <h2 class="h1">{title}</h2>
        <p class="dateline">
          {shop && <span class="stamp">Coffee review</span>}
          <b>{isNaN(date.valueOf()) ? pubDate : formatDate(date)}</b>
        </p>

        {shop && <ShopBlock shop={shop} rating={rating} />}

        {body.trim() ? (
          <div class={proseClass} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p class="plot-empty">Preview appears as you type.</p>
        )}
      </article>
    </div>
  );
}
