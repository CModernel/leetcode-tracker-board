import { ChevronDown, ChevronUp } from "lucide-react";
import { MAX_EDIT_MS, formatDuration, parseDuration } from "../lib/timer";

// One second up or down from a typed time, kept between 0 and `maxMs`: 0:59 up
// is 1:00. Returns the new text, or null when the text is not a valid time.
export const stepTime = (text, seconds, maxMs = MAX_EDIT_MS) => {
  const ms = parseDuration(text);
  if (ms === null) return null;
  return formatDuration(Math.min(maxMs, Math.max(0, ms + seconds * 1000)));
};

// The text field of a time (m:ss) with arrows to go down or up one second at a
// time (also the arrow keys). It cannot go above `maxMs`. The parent keeps the
// text (`value`, `onChange(text)`); `className` styles the input.
const TimeField = ({ id, value, onChange, maxMs, invalid = false, describedBy, className = "" }) => {
  const step = (seconds) => {
    const next = stepTime(value, seconds, maxMs);
    if (next !== null) onChange(next);
  };
  const ms = parseDuration(value);
  const arrow =
    "flex h-4 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-700";

  return (
    <div className="inline-flex items-center gap-1">
      <input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            step(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        className={className}
      />
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => step(1)}
          disabled={ms === null || ms >= maxMs}
          aria-label="One second more"
          className={arrow}
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={ms === null || ms <= 0}
          aria-label="One second less"
          className={arrow}
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default TimeField;
