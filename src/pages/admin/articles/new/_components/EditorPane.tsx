import { useRef, useState } from "preact/hooks";
import {
  imageFilesFrom,
  insertAtCursor,
  prefixLines,
  wrapSelection,
} from "../../../../../lib/editor/textarea";

interface Props {
  body: string;
  onBody: (value: string) => void;
  onImages: (files: File[], textarea: HTMLTextAreaElement) => void;
}

export default function EditorPane({ body, onBody, onImages }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);

  const withTextarea = (action: (textarea: HTMLTextAreaElement) => void) => () => {
    const textarea = textareaRef.current;
    if (textarea) action(textarea);
  };

  const handleFiles = (files: File[]) => {
    const textarea = textareaRef.current;
    if (textarea && files.length > 0) onImages(files, textarea);
  };

  return (
    <div class="flex h-full min-w-0 flex-col">
      <div class="join border-base-300 flex-wrap border-b p-2">
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item font-bold"
          title="Bold"
          onClick={withTextarea((t) => wrapSelection(t, "**", "**", "bold text"))}
        >
          B
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item italic"
          title="Italic"
          onClick={withTextarea((t) => wrapSelection(t, "_", "_", "italic text"))}
        >
          I
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item font-mono"
          title="Inline code"
          onClick={withTextarea((t) => wrapSelection(t, "`", "`", "code"))}
        >
          {"</>"}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item"
          title="Link"
          onClick={withTextarea((t) => wrapSelection(t, "[", "](https://)", "label"))}
        >
          Link
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item"
          title="Heading"
          onClick={withTextarea((t) => prefixLines(t, "## "))}
        >
          H2
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item"
          title="Quote"
          onClick={withTextarea((t) => prefixLines(t, "> "))}
        >
          &ldquo;
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item"
          title="Bullet list"
          onClick={withTextarea((t) => prefixLines(t, "- "))}
        >
          List
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm join-item"
          title="Code block"
          onClick={withTextarea((t) => insertAtCursor(t, "\n```\n\n```\n"))}
        >
          Block
        </button>
      </div>

      <div
        class={`relative min-h-0 flex-1 ${dragging ? "bg-primary/5" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(imageFilesFrom(event.dataTransfer));
        }}
      >
        <textarea
          ref={textareaRef}
          class="textarea h-full min-h-[60vh] w-full resize-none overflow-y-auto rounded-none border-0 font-mono text-sm leading-relaxed focus:outline-none md:min-h-0"
          placeholder="Write in Markdown. Drop or paste an image to upload it."
          value={body}
          onInput={(event) => onBody(event.currentTarget.value)}
          onPaste={(event) => {
            const files = imageFilesFrom(event.clipboardData);
            if (files.length === 0) return;
            // Let the upload own the insertion point instead of pasting a filename.
            event.preventDefault();
            handleFiles(files);
          }}
        />

        {dragging && (
          <div class="border-primary bg-base-100/80 pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed">
            <span class="font-semibold">Drop to upload</span>
          </div>
        )}
      </div>
    </div>
  );
}
