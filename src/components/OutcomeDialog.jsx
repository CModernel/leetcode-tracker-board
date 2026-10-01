import { useEffect, useRef } from "react";
import { HELP } from "../lib/attempts";

const STYLES = {
  [HELP.ALONE]: "border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20",
  [HELP.NOTE]: "border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
  [HELP.SOLUTION]: "border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
};

// "How did it go?" for a review: the three outcomes, each with what it does to
// the calendar (real dates). Choosing one applies it; Cancel, Escape and a
// click on the backdrop close the dialog and change nothing. `suggested` is the
// help the person probably needed (they opened the note or the solution):
// that choice is highlighted and has the focus, so Enter takes it. Without a
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
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${STYLES[option.help]} ${
                option.help === suggested ? "ring-2 ring-blue-400" : ""
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
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
