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
  const original = textarea.value.slice(start, end);
  const hadSelection = textarea.selectionStart !== textarea.selectionEnd;
  const caret = textarea.selectionStart;

  const rewritten = original.split("\n").map(transform).join("\n");

  textarea.focus();
  textarea.setSelectionRange(start, end);
  insertAtCursor(textarea, rewritten);

  // Restoring the selection is what makes consecutive toolbar clicks work.
  // Without it the caret collapses to the end of the block, so converting a
  // multi-line list from bullets to numbers and back would only touch the last
  // line the second time. A collapsed caret stays collapsed, shifted by the
  // length the line grew or shrank.
  if (hadSelection) {
    textarea.setSelectionRange(start, start + rewritten.length);
  } else {
    const moved = Math.max(start, caret + (rewritten.length - original.length));
    textarea.setSelectionRange(moved, moved);
  }
}

/** Prefix every line the selection touches, for quotes. */
export function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
  transformLines(textarea, (line) => (line.startsWith(prefix) ? line : `${prefix}${line}`));
}

/** indent, marker, gap, content — the four parts of a list line. */
const LIST_ITEM = /^([ \t]*)([-*+]|\d+\.)([ \t]+)(.*)$/;
const ANY_MARKER = /^[ \t]*(?:[-*+]|\d+\.)[ \t]+/;
const INDENT = "  ";

/** Converts between list types rather than stacking markers. */
export function toBulletList(textarea: HTMLTextAreaElement): void {
  transformLines(textarea, (line) => {
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    return `${indent}- ${line.replace(ANY_MARKER, "").trimStart()}`;
  });
}

export function toOrderedList(textarea: HTMLTextAreaElement): void {
  let n = 0;
  transformLines(textarea, (line) => {
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    n += 1;
    return `${indent}${n}. ${line.replace(ANY_MARKER, "").trimStart()}`;
  });
}

function currentLine(textarea: HTMLTextAreaElement) {
  const { start, end } = selectedLineRange(textarea);
  return { start, end, text: textarea.value.slice(start, end) };
}

/** Rewrite the caret's line, keeping the caret at the same spot in the text. */
function replaceCurrentLine(textarea: HTMLTextAreaElement, next: string): void {
  const { start, end, text } = currentLine(textarea);
  const caret = textarea.selectionStart;

  textarea.setSelectionRange(start, end);
  insertAtCursor(textarea, next);

  const moved = Math.max(start, caret + (next.length - text.length));
  textarea.setSelectionRange(moved, moved);
}

function shiftIndent(textarea: HTMLTextAreaElement, direction: 1 | -1): boolean {
  const { text } = currentLine(textarea);
  if (!LIST_ITEM.test(text)) return false;

  if (direction === 1) {
    replaceCurrentLine(textarea, INDENT + text);
    return true;
  }

  if (!text.startsWith(INDENT)) return false;
  replaceCurrentLine(textarea, text.slice(INDENT.length));
  return true;
}

/**
 * List behaviour on Enter, Tab and Backspace.
 *
 * Returns true when it handled the key, so the caller can preventDefault. Every
 * path that isn't clearly a list operation returns false and lets the textarea
 * behave normally — Backspace especially, since hijacking it away from plain
 * deletion would be far worse than not indenting.
 */
export function handleListKey(textarea: HTMLTextAreaElement, event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  const { start, text } = currentLine(textarea);
  const match = text.match(LIST_ITEM);

  if (event.key === "Tab") {
    // Only inside a list; elsewhere Tab stays a focus move.
    return shiftIndent(textarea, event.shiftKey ? -1 : 1);
  }

  if (!match) return false;
  const [, indent, marker, gap, content] = match;

  if (event.key === "Enter") {
    if (content.trim() === "") {
      // An empty item means "done with this level": outdent, then leave the list.
      if (indent.length >= INDENT.length) return shiftIndent(textarea, -1);
      replaceCurrentLine(textarea, "");
      return true;
    }

    const ordered = /^\d+\.$/.test(marker);
    const nextMarker = ordered ? `${Number.parseInt(marker, 10) + 1}.` : marker;
    insertAtCursor(textarea, `\n${indent}${nextMarker}${gap}`);
    return true;
  }

  if (event.key === "Backspace") {
    const contentStart = start + indent.length + marker.length + gap.length;
    const collapsed = textarea.selectionStart === textarea.selectionEnd;

    // Only at the very start of the item's text, so mid-word deletion is normal.
    if (!collapsed || textarea.selectionStart !== contentStart) return false;

    if (indent.length >= INDENT.length) return shiftIndent(textarea, -1);
    replaceCurrentLine(textarea, content);
    return true;
  }

  return false;
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
