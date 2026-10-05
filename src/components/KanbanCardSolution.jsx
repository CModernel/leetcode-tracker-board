import { useState } from "react";
import { Braces } from "lucide-react";
import ProblemSolutionDialog from "./ProblemSolutionDialog";

// The solution icon of a card, next to the note icon. It is grey, and blue and
// bolder (like the note) when there is a solution; it opens the dialog (the
// code is read there, like a note) or, without one, the editor. The tooltip
// never shows any code.
const KanbanCardSolution = ({ problem, solutions }) => {
  const [open, setOpen] = useState(false);
  const has = solutions.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={has ? "Open solution" : "Add solution"}
        title={has ? "Open solution" : "Add solution"}
        className={`p-1 rounded transition-colors ${
          has
            ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600"
            : "text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
        }`}
      >
        <Braces size={16} strokeWidth={has ? 2.75 : 2} />
      </button>
      {open && (
        <ProblemSolutionDialog
          problem={problem}
          solutions={solutions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default KanbanCardSolution;
