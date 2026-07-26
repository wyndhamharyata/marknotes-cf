/**
 * Every mutation here goes through execCommand("insertText") rather than
 * assigning `textarea.value`, because it is the only way to change the content
 * while keeping the browser's native undo stack intact.
 */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  textarea.focus();

  if (document.execCommand("insertText", false, text)) return;

  const { selectionStart, selectionEnd, value } = textarea;
  textarea.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  textarea.selectionStart = textarea.selectionEnd = selectionStart + text.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

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

function selectedLineRange(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const { selectionStart, selectionEnd, value } = textarea;
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  return { start, end: lineEnd === -1 ? value.length : lineEnd };
}

function transformLines(
  textarea: HTMLTextAreaElement,
  transform: (lines: string[]) => string[]
): void {
  const { start, end } = selectedLineRange(textarea);
  const original = textarea.value.slice(start, end);
  const hadSelection = textarea.selectionStart !== textarea.selectionEnd;
  const caret = textarea.selectionStart;

  const rewritten = transform(original.split("\n")).join("\n");

  textarea.focus();
  textarea.setSelectionRange(start, end);
  insertAtCursor(textarea, rewritten);

  // Restoring the selection is what lets consecutive toolbar clicks work; a
  // collapsed caret would leave the second click seeing only the last line.
  if (hadSelection) {
    textarea.setSelectionRange(start, start + rewritten.length);
  } else {
    const moved = Math.max(start, caret + (rewritten.length - original.length));
    textarea.setSelectionRange(moved, moved);
  }
}

export function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
  transformLines(textarea, (lines) =>
    lines.map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
  );
}

const HEADING_PREFIX = /^(#{1,6})\s+/;

/** Replaces any existing marker, so H2 to H3 does not stack into an H5. */
export function setHeadingLevel(textarea: HTMLTextAreaElement, level: number): void {
  const marker = level > 0 ? `${"#".repeat(level)} ` : "";
  transformLines(textarea, (lines) =>
    lines.map((line) => `${marker}${line.replace(HEADING_PREFIX, "")}`)
  );
}

export function currentHeadingLevel(textarea: HTMLTextAreaElement): number {
  const { start } = selectedLineRange(textarea);
  const lineEnd = textarea.value.indexOf("\n", start);
  const line = textarea.value.slice(start, lineEnd === -1 ? undefined : lineEnd);
  return line.match(HEADING_PREFIX)?.[1].length ?? 0;
}

const LIST_ITEM = /^([ \t]*)([-*+]|\d+\.)([ \t]+)(.*)$/;
const LIST_PREFIX = /^([ \t]*(?:[-*+]|\d+\.)[ \t]+)/;
const ANY_MARKER = /^[ \t]*(?:[-*+]|\d+\.)[ \t]+/;
const INDENT = "  ";

/**
 * Restarts the count at each nesting level. Markdown renderers take the `<ol>`
 * `start` attribute from the first item, so an indented item left numbered "3."
 * renders its sublist beginning at the third marker. Bullets keep their marker
 * but still advance their level's counter.
 */
function renumberOrderedItems(lines: string[]): string[] {
  const counters: { indent: number; n: number }[] = [];
  let baseWidth: number | null = null;

  return lines.map((line) => {
    const match = line.match(LIST_ITEM);
    if (!match) return line;

    const [, indent, marker, gap, content] = match;
    const width = indent.length;
    const ordered = /^(\d+)\.$/.exec(marker);

    if (baseWidth === null) baseWidth = width;

    while (counters.length > 0 && counters[counters.length - 1]!.indent > width) counters.pop();

    let level = counters[counters.length - 1];
    if (!level || level.indent < width) {
      // The outermost level keeps whatever number the author started on, since
      // `1.` versus `3.` is a real choice that markdown renders as <ol start>.
      const seed = width === baseWidth && ordered ? Number(ordered[1]) - 1 : 0;
      level = { indent: width, n: seed };
      counters.push(level);
    }
    level.n += 1;

    return ordered ? `${indent}${level.n}.${gap}${content}` : line;
  });
}

export function toBulletList(textarea: HTMLTextAreaElement): void {
  transformLines(textarea, (lines) =>
    lines.map((line) => {
      const indent = line.match(/^[ \t]*/)?.[0] ?? "";
      return `${indent}- ${line.replace(ANY_MARKER, "").trimStart()}`;
    })
  );
}

export function toOrderedList(textarea: HTMLTextAreaElement): void {
  transformLines(textarea, (lines) =>
    renumberOrderedItems(
      lines.map((line) => {
        const indent = line.match(/^[ \t]*/)?.[0] ?? "";
        return `${indent}1. ${line.replace(ANY_MARKER, "").trimStart()}`;
      })
    )
  );
}

function currentLine(textarea: HTMLTextAreaElement) {
  const { start, end } = selectedLineRange(textarea);
  return { start, end, text: textarea.value.slice(start, end) };
}

function listBlockRange(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const { value } = textarea;
  const line = currentLine(textarea);

  let start = line.start;
  while (start > 0) {
    const previousStart = value.lastIndexOf("\n", start - 2) + 1;
    if (!LIST_ITEM.test(value.slice(previousStart, start - 1))) break;
    start = previousStart;
  }

  let end = line.end;
  while (end < value.length) {
    const newline = value.indexOf("\n", end + 1);
    const nextEnd = newline === -1 ? value.length : newline;
    if (!LIST_ITEM.test(value.slice(end + 1, nextEnd))) break;
    end = nextEnd;
  }

  return { start, end };
}

function contentOffset(textarea: HTMLTextAreaElement, line: { start: number; text: string }) {
  const prefix = line.text.match(LIST_PREFIX)?.[1].length ?? 0;
  return Math.max(0, textarea.selectionStart - line.start - prefix);
}

/**
 * Edits the caret's list block, renumbers it and writes it back in one change,
 * so a single Tab takes a single undo to reverse. `edit` returns where the caret
 * belongs as a line index plus an offset into that line's text — offsets skip
 * the marker because renumbering changes its width when 9 becomes 10.
 */
function rewriteListBlock(
  textarea: HTMLTextAreaElement,
  edit: (lines: string[], index: number) => { line: number; offset: number }
): boolean {
  const line = currentLine(textarea);
  const block = listBlockRange(textarea);
  const original = textarea.value.slice(block.start, block.end);

  const lines = original.split("\n");
  const index = original.slice(0, line.start - block.start).split("\n").length - 1;

  const target = edit(lines, index);
  const rewritten = renumberOrderedItems(lines);

  textarea.focus();
  textarea.setSelectionRange(block.start, block.end);
  insertAtCursor(textarea, rewritten.join("\n"));

  const lineStart =
    block.start + rewritten.slice(0, target.line).reduce((sum, l) => sum + l.length + 1, 0);
  const prefix = rewritten[target.line]?.match(LIST_PREFIX)?.[1].length ?? 0;
  const caret = lineStart + prefix + target.offset;

  textarea.setSelectionRange(caret, caret);
  return true;
}

function shiftIndent(textarea: HTMLTextAreaElement, direction: 1 | -1): boolean {
  const line = currentLine(textarea);
  if (!LIST_ITEM.test(line.text)) return false;
  if (direction === -1 && !line.text.startsWith(INDENT)) return false;

  const offset = contentOffset(textarea, line);

  return rewriteListBlock(textarea, (lines, index) => {
    lines[index] = direction === 1 ? INDENT + lines[index] : lines[index]!.slice(INDENT.length);
    return { line: index, offset };
  });
}

/**
 * Returns true when it handled the key, so the caller can preventDefault.
 * Anything not clearly a list operation returns false — Backspace especially,
 * since hijacking it away from plain deletion would be worse than not indenting.
 */
export function handleListKey(textarea: HTMLTextAreaElement, event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  const { start, text } = currentLine(textarea);
  const match = text.match(LIST_ITEM);

  if (event.key === "Tab") return shiftIndent(textarea, event.shiftKey ? -1 : 1);

  if (!match) return false;
  const [, indent, marker, gap, content] = match;

  if (event.key === "Enter") {
    if (content.trim() === "") {
      if (indent.length >= INDENT.length) return shiftIndent(textarea, -1);
      return rewriteListBlock(textarea, (lines, index) => {
        lines[index] = "";
        return { line: index, offset: 0 };
      });
    }

    const offset = contentOffset(textarea, { start, text });
    const prefix = text.match(LIST_PREFIX)?.[1] ?? "";

    return rewriteListBlock(textarea, (lines, index) => {
      const body = lines[index]!.slice(prefix.length);
      lines[index] = prefix + body.slice(0, offset);
      lines.splice(index + 1, 0, `${indent}${marker}${gap}${body.slice(offset)}`);
      return { line: index + 1, offset: 0 };
    });
  }

  if (event.key === "Backspace") {
    const contentStart = start + indent.length + marker.length + gap.length;
    const collapsed = textarea.selectionStart === textarea.selectionEnd;
    if (!collapsed || textarea.selectionStart !== contentStart) return false;

    if (indent.length >= INDENT.length) return shiftIndent(textarea, -1);
    return rewriteListBlock(textarea, (lines, index) => {
      lines[index] = content;
      return { line: index, offset: 0 };
    });
  }

  return false;
}

/**
 * Swaps a substring without disturbing the author. Routing this through state
 * instead would reassign `textarea.value`, throwing the caret to the end and
 * clearing undo — exactly wrong when an upload lands mid-typing. Returns false
 * if the needle is gone, so the caller can fall back to a state update.
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

  const delta = replacement.length - search.length;
  const shift = (position: number) =>
    position > index ? Math.max(index, position + delta) : position;
  textarea.setSelectionRange(shift(caretStart), shift(caretEnd));

  return true;
}

export function imageFilesFrom(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  return Array.from(transfer.files).filter((file) => file.type.startsWith("image/"));
}
