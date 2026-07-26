/**
 * Textarea mutation helpers.
 *
 * Everything goes through `document.execCommand("insertText")` rather than
 * assigning `textarea.value`. That is the one way to change the content while
 * keeping the browser's native undo stack intact — a direct assignment wipes
 * it, so the author loses Cmd+Z on everything the toolbar touched. It also
 * fires a real `input` event, which is what feeds the change back into state.
 */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  textarea.focus();

  if (document.execCommand("insertText", false, text)) return;

  // Fallback where execCommand is unavailable: correct, but costs undo history.
  const { selectionStart, selectionEnd, value } = textarea;
  textarea.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  textarea.selectionStart = textarea.selectionEnd = selectionStart + text.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Wrap the selection, or drop the markers at the cursor and place the caret
 * between them so the author can keep typing.
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = ""
): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;

  insertAtCursor(textarea, `${before}${selected}${after}`);

  if (selected === placeholder) {
    const caret = selectionStart + before.length;
    textarea.selectionStart = caret;
    textarea.selectionEnd = caret + placeholder.length;
  }
}

/** Prefix every line the selection touches, for headings, quotes and lists. */
export function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
  const { selectionStart, selectionEnd, value } = textarea;

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join("\n");

  textarea.focus();
  textarea.setSelectionRange(lineStart, lineEnd);
  insertAtCursor(textarea, prefixed);
}

/**
 * Swap one substring for another without disturbing the author.
 *
 * Doing this through state instead would reassign `textarea.value` on the next
 * render, which jumps the caret to the end and clears undo — precisely the
 * wrong behaviour when an upload finishes while someone is typing further down
 * the document. Going through the selection keeps both intact.
 *
 * Returns false when the needle is gone (the author deleted the placeholder),
 * so the caller can fall back to a state update.
 */
export function replaceInTextarea(
  textarea: HTMLTextAreaElement,
  search: string,
  replacement: string
): boolean {
  const index = textarea.value.indexOf(search);
  if (index === -1) return false;

  const caretStart = textarea.selectionStart;
  const caretEnd = textarea.selectionEnd;

  textarea.setSelectionRange(index, index + search.length);
  insertAtCursor(textarea, replacement);

  // Anything after the edit shifts by the length difference.
  const delta = replacement.length - search.length;
  const shift = (position: number) =>
    position > index ? Math.max(index, position + delta) : position;
  textarea.setSelectionRange(shift(caretStart), shift(caretEnd));

  return true;
}

/** Files from a drop or paste that are actually images. */
export function imageFilesFrom(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  return Array.from(transfer.files).filter((file) => file.type.startsWith("image/"));
}
