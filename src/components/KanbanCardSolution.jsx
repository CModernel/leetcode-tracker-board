import { useState } from "react";
import { Code2 } from "lucide-react";
import ProblemSolutionDialog from "./ProblemSolutionDialog";

// The solution icon of a card, next to the note icon. With a solution it is
// highlighted and opens the dialog (the code stays hidden until "Show
// solution"); without one it is a quiet icon that opens the editor. The tooltip
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
            ? "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-600"
            : "text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
        }`}
      >
        <Code2 size={16} />
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
