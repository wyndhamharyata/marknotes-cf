import { useEffect, useState } from "preact/hooks";
import { renderPreview } from "../../../../../lib/editor/preview-render";
import type { InlineAsset } from "../../../../../lib/editor/types";

interface Props {
  body: string;
  assets: InlineAsset[];
  proseClass: string;
}

/** Long enough to skip a burst of keystrokes, short enough to feel live. */
const RENDER_DEBOUNCE_MS = 200;

export default function PreviewPane({ body, assets, proseClass }: Props) {
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

  if (!body.trim()) {
    return (
      <div class="text-base-content/50 flex h-full min-h-[60vh] items-center justify-center p-8 text-sm">
        Preview appears as you type.
      </div>
    );
  }

  return (
    <div class="h-full min-h-[60vh] overflow-y-auto p-4 md:min-h-0 md:p-6">
      <div class={proseClass} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
