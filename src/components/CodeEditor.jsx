import { forwardRef, useRef } from "react";

const LINE_HEIGHT = "1.5rem";
const FONT = "font-mono text-sm";
const PAD = "py-3";
const INDENT = "    ";

// Replaces start..end of the textarea. execCommand keeps the browser's undo
// history; without it (old browsers, jsdom) the value is set directly.
const replaceRange = (textarea, start, end, text, onChange) => {
  textarea.setSelectionRange(start, end);
  const done =
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text);
  if (!done) {
    textarea.setRangeText(text, start, end, "end");
    onChange(textarea.value);
  }
};

// Tab indents instead of moving the focus (Shift+Tab outdents). With a
// selection over several lines, every line of it moves. Returns false when the
// key is not for the editor.
const handleTab = (event, onChange) => {
  if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return false;
  event.preventDefault();
  const textarea = event.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const multiline = value.slice(start, end).includes("\n");
  if (!event.shiftKey && !multiline) {
    replaceRange(textarea, start, end, INDENT, onChange);
    return true;
  }
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let blockEnd = end;
  if (!(end > start && value[end - 1] === "\n")) {
    const lineEnd = value.indexOf("\n", end);
    blockEnd = lineEnd === -1 ? value.length : lineEnd;
  } else {
    blockEnd = end - 1;
  }
  const block = value.slice(lineStart, blockEnd);
  const moved = block
    .split("\n")
    .map((line) =>
      event.shiftKey ? line.replace(/^( {1,4}|\t)/, "") : line === "" ? line : INDENT + line,
    )
    .join("\n");
  replaceRange(textarea, lineStart, blockEnd, moved, onChange);
  if (start === end) {
    const caret = Math.max(lineStart, start + moved.length - block.length);
    textarea.setSelectionRange(caret, caret);
  } else {
    textarea.setSelectionRange(lineStart, lineStart + moved.length);
  }
  return true;
};

// A plain textarea that looks like a code editor: monospace, a code-block
// background (the same colours as the highlighted block) and a gutter with line
// numbers. Lines never wrap (so each number is one real line) and scroll
// sideways instead. The gutter follows the vertical scroll of the text. No
// colours while typing: the highlight is only for reading. Tab indents (4
// spaces) instead of leaving the field.
const CodeEditor = forwardRef(function CodeEditor(
  { value, onChange, maxLength, placeholder, ariaLabel, rows = 14 },
  ref,
) {
  const gutter = useRef(null);
  const lines = Math.max(value.split("\n").length, rows);
  const digits = String(lines).length;

  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-[#fafafa] dark:bg-[#282c34] focus-within:ring-2 focus-within:ring-blue-400 ${FONT}`}
    >
      <div
        ref={gutter}
        aria-hidden="true"
        data-testid="line-numbers"
        style={{ lineHeight: LINE_HEIGHT, width: `${digits + 2}ch`, height: `calc(${rows} * ${LINE_HEIGHT} + 1.5rem)` }}
        className={`${PAD} flex-shrink-0 select-none overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-black/[0.03] dark:bg-black/20 pr-2 text-right text-gray-400 dark:text-gray-500`}
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleTab(event, onChange)}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.target.scrollTop;
        }}
        style={{ lineHeight: LINE_HEIGHT, height: `calc(${rows} * ${LINE_HEIGHT} + 1.5rem)` }}
        className={`${PAD} min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none`}
      />
    </div>
  );
});

export default CodeEditor;
