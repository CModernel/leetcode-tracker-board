import { useState } from "react";
import { Code2 } from "lucide-react";
import ProblemSolutionDialog from "./ProblemSolutionDialog";

// The solution icon of a card, next to the note icon. It is always grey, darker and
// bolder when there is a solution; it opens the dialog (the code stays hidden
// until "Show solution") or, without one, the editor. The tooltip never shows
// any code.
const KanbanCardSolution = ({ problem, solutions }) => {
  const [open, setOpen] = useState(false);
  const has = solutions.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={has ? "Open solution" : "Add solution"}
        title={has ? "Open solution" : "Add solution"}
        className={`p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 ${
          has ? "text-gray-700 dark:text-gray-100" : "text-gray-400 dark:text-gray-400"
        }`}
      >
        <Code2 size={16} fill={has ? "currentColor" : "none"} fillOpacity={0.15} strokeWidth={has ? 2.5 : 2} />
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
