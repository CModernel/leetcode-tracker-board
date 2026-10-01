import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { NOTE_HINT, NOTE_MAX_LENGTH } from "../lib/notes";

// A problem's note in a centered dialog (native <dialog>, like ConfirmDialog),
// shown as soon as it is rendered. A note that exists opens to be READ, with
// Close and Edit (reading is what is done most of the time, so it must not look
// like editing). A problem with no note opens straight in the editor. In the
// editor, Save or Ctrl/Cmd+Enter saves (an empty text removes the note);
// Cancel closes without saving. Escape and a click on the backdrop close the
// dialog in both. `onSave` gets the new text.
const NoteDialog = ({ label, note, onSave, onClose }) => {
  const dialogRef = useRef(null);
  const [draft, setDraft] = useState(note ?? "");
  const [mode, setMode] = useState(note ? "read" : "edit");
  const editing = mode === "edit";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  const save = () => {
    if (draft !== (note ?? "")) onSave(draft);
    onClose();
  };

  // The dialog sits inside a card that can be dragged. React passes events up
  // through the tree, so mouse, touch and keys used here are kept from reaching
  // the card: selecting text must not drag it, and Space must not lift it.
  const keep = (event) => event.stopPropagation();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="note-title"
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
      onKeyDown={(event) => {
        keep(event);
        if (editing && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          save();
        }
      }}
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="note-title" className="text-lg font-semibold">
          Note
        </h2>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{label}</p>
        {editing ? (
          <>
            <textarea
              autoFocus
              value={draft}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={NOTE_HINT}
              aria-label={`Note for ${label}`}
              rows={6}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-3 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p
              aria-live="polite"
              className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400"
            >
              {draft.length}/{NOTE_MAX_LENGTH}
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-sm text-gray-900 dark:text-gray-100">
              {note}
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                autoFocus
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setMode("edit")}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
};

export default NoteDialog;
