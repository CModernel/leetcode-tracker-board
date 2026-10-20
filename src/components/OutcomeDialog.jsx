import { useEffect, useRef, useState } from "react";
import { HELP } from "../lib/attempts";
import { formatDuration, parseDuration } from "../lib/timer";

// Each option carries a barely visible hint of its color (green alone, yellow
// needed help) in the border, the fill and the title: enough to tell them apart
// without drawing the eye. The suggested one is told apart by its badge, not by
// another color, so the colors keep their meaning.
const STYLES = {
  [HELP.ALONE]: {
    box: "border-green-200/70 bg-green-50/30 hover:bg-green-50/60 dark:border-green-900/40 dark:bg-green-900/5 dark:hover:bg-green-900/15",
    label: "text-gray-800 dark:text-gray-100",
  },
  [HELP.NOTE]: {
    box: "border-yellow-200/70 bg-yellow-50/30 hover:bg-yellow-50/60 dark:border-yellow-900/40 dark:bg-yellow-900/5 dark:hover:bg-yellow-900/15",
    label: "text-gray-800 dark:text-gray-100",
  },
};

// "How did it go?" for a review: the outcomes, each with what it does to
// the calendar (real dates). Choosing one applies it; Cancel, Escape and a
// click on the backdrop close the dialog and change nothing. `suggested` is the
// help the person probably needed (they opened the note, or the timer ran out:
// `timedOut`):
// that choice has a light background and a "Suggested" badge and has the focus, so Enter takes it. Without a
// suggestion the focus is on "Solved it myself". Native <dialog>
// like the others. `timeMs` (the time counted when it opened, null without a
// timer) adds an optional "Time" field with it: it can be lowered, never
// raised, and the answer is `onChoose(option, ms)` with `ms` only when it was
// changed. It sits inside a draggable card, so mouse, touch and keys
// are kept from reaching the card.
const OutcomeDialog = ({ title, options, suggested = null, timedOut = false, timeMs = null, onChoose, onClose }) => {
  const dialogRef = useRef(null);
  // The time when the dialog opened is the most that can be typed
  const [counted] = useState(timeMs);
  const shown = counted === null ? "" : formatDuration(counted);
  const [text, setText] = useState(shown);
  const [timeError, setTimeError] = useState(false);

  // Takes an outcome. A time that was changed must be valid and not higher.
  const choose = (option) => {
    if (counted === null || text.trim() === shown) return onChoose(option);
    const ms = parseDuration(text);
    if (ms === null || ms > counted) return setTimeError(true);
    return onChoose(option, ms);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // showModal() moves the focus to the first button after React's autoFocus,
    // so put it on the one Enter should take (the suggested one) by hand
    dialog.querySelector("[data-initial-focus]")?.focus();
  }, []);

  const keep = (event) => event.stopPropagation();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="outcome-title"
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
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="outcome-title" className="text-lg font-semibold">
          How did it go?
        </h2>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{title}</p>
        {suggested !== null && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {timedOut
              ? "The timer ran past twice the limit."
              : suggested === HELP.ALONE
              ? "You wrote or edited the note today, so it does not count as help."
              : "You opened the note today."}
          </p>
        )}
        {counted !== null && (
          <div className="mt-4">
            <label htmlFor="outcome-time" className="block text-sm font-medium text-gray-800 dark:text-gray-100">
              Time (optional)
            </label>
            <input
              id="outcome-time"
              value={text}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={timeError || undefined}
              aria-describedby={timeError ? "outcome-time-error" : undefined}
              onChange={(event) => {
                setText(event.target.value);
                setTimeError(false);
              }}
              className="mt-1 w-28 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1.5 text-sm tabular-nums text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {timeError ? (
              <p id="outcome-time-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                Use a time like 7:20, no higher than {shown}.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You can lower it if the timer kept running. It cannot go up.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.help}
              autoFocus={option.help === (suggested ?? HELP.ALONE)}
              data-initial-focus={option.help === (suggested ?? HELP.ALONE) || undefined}
              onClick={() => choose(option)}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                STYLES[option.help].box
              }`}
            >
              <span
                className={`flex items-center justify-between gap-2 text-sm font-semibold ${
                  STYLES[option.help].label
                }`}
              >
                {option.label}
                {option.help === suggested && (
                  <span className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[10px] font-medium text-blue-500 dark:text-blue-300/70">
                    Suggested
                  </span>
                )}
              </span>
              <span className="block text-xs text-gray-700 dark:text-gray-200">
                {option.detail}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default OutcomeDialog;
