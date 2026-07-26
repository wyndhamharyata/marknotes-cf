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

const HEADING_PREFIX = /^(#{1,6})\s+/;

/** The selection expanded outwards to whole lines. */
function selectedLineRange(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const { selectionStart, selectionEnd, value } = textarea;
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  return { start, end: lineEnd === -1 ? value.length : lineEnd };
}

function transformLines(textarea: HTMLTextAreaElement, transform: (line: string) => string): void {
  const { start, end } = selectedLineRange(textarea);
  const rewritten = textarea.value.slice(start, end).split("\n").map(transform).join("\n");

  textarea.focus();
  textarea.setSelectionRange(start, end);
  insertAtCursor(textarea, rewritten);
}

/** Prefix every line the selection touches, for quotes and lists. */
export function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
  transformLines(textarea, (line) => (line.startsWith(prefix) ? line : `${prefix}${line}`));
}

/**
 * Set the heading level of the selected lines, 0 meaning body text.
 *
 * Any existing marker is stripped first — switching H2 to H3 has to replace the
 * hashes, not stack them into an H5.
 */
export function setHeadingLevel(textarea: HTMLTextAreaElement, level: number): void {
  const marker = level > 0 ? `${"#".repeat(level)} ` : "";
  transformLines(textarea, (line) => `${marker}${line.replace(HEADING_PREFIX, "")}`);
}

/** Heading level of the line holding the caret; 0 for body text. */
export function currentHeadingLevel(textarea: HTMLTextAreaElement): number {
  const { start } = selectedLineRange(textarea);
  const lineEnd = textarea.value.indexOf("\n", start);
  const line = textarea.value.slice(start, lineEnd === -1 ? undefined : lineEnd);
  return line.match(HEADING_PREFIX)?.[1].length ?? 0;
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
