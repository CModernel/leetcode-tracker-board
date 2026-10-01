import { useEffect, useRef } from "react";
import { HELP } from "../lib/attempts";

// Every option has the same neutral frame; only a colored stripe on the left
// tells them apart (green alone, yellow note, red solution), so the one that is
// suggested can stand out by itself with a light blue background and a badge.
const STRIPES = {
  [HELP.ALONE]: "border-l-green-500",
  [HELP.NOTE]: "border-l-yellow-500",
  [HELP.SOLUTION]: "border-l-red-500",
};

// "How did it go?" for a review: the three outcomes, each with what it does to
// the calendar (real dates). Choosing one applies it; Cancel, Escape and a
// click on the backdrop close the dialog and change nothing. `suggested` is the
// help the person probably needed (they opened the note or the solution):
// that choice has a light background and a "Suggested" badge and has the focus, so Enter takes it. Without a
// suggestion the focus is on "Solved it myself". Native <dialog>
// like the others; it sits inside a draggable card, so mouse, touch and keys
// are kept from reaching the card.
const OutcomeDialog = ({ title, options, suggested = null, onChoose, onClose }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
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
            {suggested === HELP.SOLUTION
              ? "You opened the solution today."
              : "You opened the note today."}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.help}
              autoFocus={option.help === (suggested ?? HELP.ALONE)}
              onClick={() => onChoose(option)}
              className={`rounded-lg border border-l-4 border-gray-300 dark:border-gray-600 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                STRIPES[option.help]
              } ${option.help === suggested ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {option.label}
                {option.help === suggested && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    Suggested
                  </span>
                )}
              </span>
              <span className="block text-xs text-gray-600 dark:text-gray-300">
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
