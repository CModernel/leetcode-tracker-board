import { forwardRef, useRef } from "react";

const LINE_HEIGHT = "1.5rem";
const FONT = "font-mono text-sm";
const PAD = "py-3";

// A plain textarea that looks like a code editor: monospace, a code-block
// background (the same colours as the highlighted block) and a gutter with line
// numbers. Lines never wrap (so each number is one real line) and scroll
// sideways instead. The gutter follows the vertical scroll of the text. No
// colours while typing: the highlight is only for reading.
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
