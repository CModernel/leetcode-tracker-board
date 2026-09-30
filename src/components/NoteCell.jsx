import { useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { NOTE_HINT, NOTE_MAX_LENGTH } from "../lib/notes";

// A problem's note, edited in place. Click it (or "Add note") to edit.
// Saves when the field loses focus or with Ctrl/Cmd+Enter; Escape discards the
// changes. Enter alone adds a line. `onSave` gets the new text ("" removes it).
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
      discarded.current = true;
      setDraft(null);
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
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
        <p
          aria-live="polite"
          className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400"
        >
          {draft.length}/{NOTE_MAX_LENGTH}
        </p>
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
