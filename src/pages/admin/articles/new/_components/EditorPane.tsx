import { useCallback, useState } from "preact/hooks";
import type { RefObject } from "preact";
import {
  currentHeadingLevel,
  handleListKey,
  imageFilesFrom,
  insertAtCursor,
  prefixLines,
  setHeadingLevel,
  toBulletList,
  toOrderedList,
  wrapSelection,
} from "../../../../../lib/editor/textarea";

interface Props {
  body: string;
  onBody: (value: string) => void;
  onImages: (files: File[], textarea: HTMLTextAreaElement) => void;
  /** Owned by MdxEditor so it can drive scroll sync against the preview. */
  textareaRef: RefObject<HTMLTextAreaElement>;
}

/**
 * H1 is the article title on the rendered page and H6 is unused across the
 * existing posts, so the dropdown offers the range that actually gets written.
 */
const HEADING_OPTIONS = [
  { level: 0, label: "Normal text" },
  { level: 2, label: "Heading 2" },
  { level: 3, label: "Heading 3" },
  { level: 4, label: "Heading 4" },
  { level: 5, label: "Heading 5" },
];

export default function EditorPane({ body, onBody, onImages, textareaRef }: Props) {
  const [dragging, setDragging] = useState(false);
  const [heading, setHeading] = useState(0);

  const syncHeading = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) setHeading(currentHeadingLevel(textarea));
  }, []);

  const withTextarea = (action: (textarea: HTMLTextAreaElement) => void) => () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    action(textarea);
    syncHeading();
  };

  const handleFiles = (files: File[]) => {
    const textarea = textareaRef.current;
    if (textarea && files.length > 0) onImages(files, textarea);
  };

  // A hand-written H1 or H6 still needs a matching option, or the select blanks.
  const offScale = !HEADING_OPTIONS.some((option) => option.level === heading);

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="border-base-300 flex flex-wrap items-center gap-1 border-b p-2">
        <select
          class="select select-bordered w-40"
          value={String(heading)}
          onChange={(event) => {
            const level = Number(event.currentTarget.value);
            const textarea = textareaRef.current;
            if (!textarea) return;
            setHeadingLevel(textarea, level);
            syncHeading();
          }}
        >
          {offScale && <option value={String(heading)}>{`Heading ${heading}`}</option>}
          {HEADING_OPTIONS.map((option) => (
            <option key={option.level} value={String(option.level)}>
              {option.label}
            </option>
          ))}
        </select>

        <div class="join">
          <button
            type="button"
            class="btn btn-ghost join-item font-bold"
            title="Bold"
            onClick={withTextarea((t) => wrapSelection(t, "**", "**", "bold text"))}
          >
            B
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item italic"
            title="Italic"
            onClick={withTextarea((t) => wrapSelection(t, "_", "_", "italic text"))}
          >
            I
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item font-mono"
            title="Inline code"
            onClick={withTextarea((t) => wrapSelection(t, "`", "`", "code"))}
          >
            {"</>"}
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item"
            title="Link"
            onClick={withTextarea((t) => wrapSelection(t, "[", "](https://)", "label"))}
          >
            Link
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item"
            title="Quote"
            onClick={withTextarea((t) => prefixLines(t, "> "))}
          >
            &ldquo;
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item"
            title="Bullet list"
            onClick={withTextarea(toBulletList)}
          >
            &bull; List
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item"
            title="Numbered list"
            onClick={withTextarea(toOrderedList)}
          >
            1. List
          </button>
          <button
            type="button"
            class="btn btn-ghost join-item"
            title="Code block"
            onClick={withTextarea((t) => insertAtCursor(t, "\n```\n\n```\n"))}
          >
            Block
          </button>
        </div>
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
          class="textarea h-full min-h-[55vh] w-full resize-none overflow-y-auto rounded-none border-0 font-mono text-base leading-relaxed focus:outline-none md:min-h-0"
          placeholder="Write in Markdown. Drop or paste an image to upload it."
          value={body}
          onInput={(event) => {
            onBody(event.currentTarget.value);
            syncHeading();
          }}
          onKeyDown={(event) => {
            const textarea = textareaRef.current;
            // Enter continues the list, Tab nests it, Backspace at the start of
            // an item lifts it back out.
            if (textarea && handleListKey(textarea, event)) {
              event.preventDefault();
              syncHeading();
            }
          }}
          onKeyUp={syncHeading}
          onClick={syncHeading}
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
