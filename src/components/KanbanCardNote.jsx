import { useState } from "react";
import { FileText } from "lucide-react";
import NoteDialog from "./NoteDialog";
import { useProgress } from "../context/ProgressContext";

// The note icon of a card: it opens the note to read or edit it. With a note
// it is highlighted and the note shows as its tooltip; without one it is a
// quiet icon that adds one. Reading never changes the schedule.
const KanbanCardNote = ({ problem, note }) => {
  const { setNote, markHelpViewed } = useProgress();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          // Reading a note is studying: it changes nothing in the calendar, but
          // it is remembered so completing the review today can ask how it went
          if (note) markHelpViewed(problem.id, "note");
          setOpen(true);
        }}
        aria-label={note ? "Edit note" : "Add note"}
        title={note || "Add note"}
        className={`p-1 rounded transition-colors ${
          note
            ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600"
            : "text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
        }`}
      >
        <FileText size={16} fill={note ? "currentColor" : "none"} fillOpacity={0.2} />
      </button>
      {open && (
        <NoteDialog
          label={problem.title}
          note={note}
          onSave={(text) => setNote(problem.id, text)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default KanbanCardNote;
