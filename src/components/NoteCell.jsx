import { useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { NOTE_HINT, NOTE_MAX_LENGTH } from "../lib/notes";

// A problem's note, edited in place. Click it (or "Add note") to edit.
// Saves with the Save button, when the field loses focus or with Ctrl/Cmd+Enter;
// Cancel and Escape discard the changes. Enter alone adds a line. `onSave` gets
// the new text ("" removes it).
const NoteCell = ({ note, label, onSave }) => {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;
  // Escape closes the field, and the focus loss that follows must not save
  const discarded = useRef(false);

  const open = () => {
    discarded.current = false;
    setDraft(note ?? "");
  };
  const save = () => {
    if (discarded.current) return;
    if (draft !== (note ?? "")) onSave(draft);
    setDraft(null);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      cancel();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  // The buttons must not take the focus from the field: losing it saves, and
  // Cancel would save the very text it is meant to discard.
  const keepFocus = (event) => event.preventDefault();
  const cancel = () => {
    discarded.current = true;
    setDraft(null);
  };

  if (editing) {
    return (
      <div>
        <textarea
          autoFocus
          value={draft}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={NOTE_HINT}
          aria-label={`Note for ${label}`}
          rows={4}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          className="w-full rounded border border-blue-400 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            aria-live="polite"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {draft.length}/{NOTE_MAX_LENGTH}
          </p>
          <div className="flex gap-1.5">
            <button
              onMouseDown={keepFocus}
              onClick={cancel}
              className="rounded-lg px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onMouseDown={keepFocus}
              onClick={save}
              className="rounded-lg px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return note ? (
    <button
      onClick={open}
      aria-label={`Edit note for ${label}`}
      title={note}
      className="group w-full text-left"
    >
      <span className="line-clamp-3 whitespace-pre-wrap break-words">{note}</span>
      <Pencil
        size={12}
        aria-hidden="true"
        className="mt-1 text-gray-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
      />
    </button>
  ) : (
    <button
      onClick={open}
      aria-label={`Add note for ${label}`}
      className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      <Plus size={14} aria-hidden="true" />
      Add note
    </button>
  );
};

export default NoteCell;
