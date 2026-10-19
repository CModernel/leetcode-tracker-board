import NoteDialog from "./NoteDialog";

// Shown right after a problem is marked as solved: the note dialog opens in the
// editor (with the current note, if there is one) asking if there is anything
// to remember. Save keeps what was written, Skip closes and changes nothing; the
// problem is already solved either way.
const SolvedNotePrompt = ({ problem, note, onSave, onClose }) => (
  <NoteDialog
    label={problem.title}
    note={note}
    startEditing
    intro="Solved. Anything to remember? (Recommended)"
    cancelLabel="Skip"
    onSave={onSave}
    onClose={onClose}
  />
);

export default SolvedNotePrompt;
