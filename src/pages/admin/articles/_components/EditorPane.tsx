import { useCallback, useState } from "preact/hooks";
import type { RefObject } from "preact";
import {
  currentHeadingLevel,
  handleListKey,
  imageFilesFrom,
  insertAtCursor,
  insertTable,
  prefixLines,
  setHeadingLevel,
  toBulletList,
  toOrderedList,
  wrapSelection,
} from "../../../../lib/editor/textarea";

interface Props {
  body: string;
  onBody: (value: string) => void;
  onImages: (files: File[], textarea: HTMLTextAreaElement) => void;
  /** Owned by MdxEditor so it can drive scroll sync against the preview. */
  textareaRef: RefObject<HTMLTextAreaElement>;
}

// H1 is the page title and H6 is unused across existing posts.
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
      <div class="tools">
        <select
          aria-label="Text style"
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

        <button
          type="button"
          class="key key-sm"
          title="Bold"
          onClick={withTextarea((t) => wrapSelection(t, "**", "**", "bold text"))}
        >
          B
        </button>
        <button
          type="button"
          class="key key-sm italic"
          title="Italic"
          onClick={withTextarea((t) => wrapSelection(t, "_", "_", "italic text"))}
        >
          I
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Inline code"
          onClick={withTextarea((t) => wrapSelection(t, "`", "`", "code"))}
        >
          {"</>"}
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Link"
          onClick={withTextarea((t) => wrapSelection(t, "[", "](https://)", "label"))}
        >
          Link
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Quote"
          onClick={withTextarea((t) => prefixLines(t, "> "))}
        >
          &ldquo;
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Bullet list"
          onClick={withTextarea(toBulletList)}
        >
          &bull; List
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Numbered list"
          onClick={withTextarea(toOrderedList)}
        >
          1. List
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Code block"
          onClick={withTextarea((t) => insertAtCursor(t, "\n```\n\n```\n"))}
        >
          Block
        </button>
        <button
          type="button"
          class="key key-sm"
          title="Table"
          onClick={withTextarea((t) => insertTable(t))}
        >
          Table
        </button>
      </div>

      <div
        class="relative flex min-h-0 flex-1 flex-col"
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
          class="ruled source"
          aria-label="Article body"
          value={body}
          onInput={(event) => {
            onBody(event.currentTarget.value);
            syncHeading();
          }}
          onKeyDown={(event) => {
            const textarea = textareaRef.current;
            // Enter continues, Tab nests, Backspace at an item start outdents.
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

        {dragging && <div class="drop">Drop to upload</div>}
      </div>
    </div>
  );
}
