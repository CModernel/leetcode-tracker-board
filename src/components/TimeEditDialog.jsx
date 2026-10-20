import { useEffect, useRef, useState } from "react";
import TimeField from "./TimeField";
import { MAX_EDIT_MS, formatDuration, parseDuration } from "../lib/timer";

// Corrects a time by hand: a field in m:ss (also h:mm:ss, or just minutes), in a
// centered native <dialog> like the others, shown as soon as it is rendered.
// Save or Enter saves a valid time; an invalid one shows the error under the
// field and keeps the dialog open. `onRemove` (only for a time already
// recorded) adds "Remove time". `maxMs` is the most that can be saved (a time can
// be corrected down, never up); a bigger one shows its own error: the time becomes unknown, never 0. Cancel,
// Escape and a click on the backdrop close without changing anything. It sits
// inside a draggable card, so mouse, touch and keys are kept from reaching it.
const TimeEditDialog = ({ label, title = "Edit time", initialMs, maxMs = MAX_EDIT_MS, onSave, onRemove = null, onClose }) => {
  const dialogRef = useRef(null);
  const [text, setText] = useState(formatDuration(initialMs));
  // "invalid" (not a time), "too-long" (more than maxMs) or null
  const [error, setError] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // showModal() moves the focus after React's autoFocus, so put it by hand
    const field = dialog.querySelector("input");
    field?.focus();
    field?.select();
  }, []);

  const save = () => {
    const ms = parseDuration(text);
    if (ms === null || ms > maxMs) {
      setError(ms === null ? "invalid" : "too-long");
      return;
    }
    onSave(ms);
    onClose();
  };

  const keep = (event) => event.stopPropagation();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="time-edit-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        keep(event);
        if (event.target === dialogRef.current) onClose();
      }}
      onMouseDown={keep}
      onTouchStart={keep}
      onPointerDown={keep}
      onKeyDown={keep}
      className="cursor-default m-auto p-0 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <form
        className="p-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 id="time-edit-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{label}</p>
        <label className="mt-4 mb-1 block text-sm font-medium text-gray-800 dark:text-gray-100" htmlFor="time-edit-field">
          Time (m:ss)
        </label>
        <TimeField
          id="time-edit-field"
          value={text}
          maxMs={maxMs}
          invalid={Boolean(error)}
          describedBy={error ? "time-edit-error" : undefined}
          onChange={(value) => {
            setText(value);
            setError(null);
          }}
          className="w-32 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm tabular-nums text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {error && (
          <p id="time-edit-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error === "too-long"
              ? `A time can only be lowered: ${formatDuration(maxMs)} at most.`
              : `Use minutes and seconds, like 7:20 (up to ${formatDuration(MAX_EDIT_MS)}).`}
          </p>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors sm:mr-auto"
            >
              Remove time
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default TimeEditDialog;
