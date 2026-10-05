import { useState } from "react";
import { Braces, Plus } from "lucide-react";
import ProblemSolutionDialog from "./ProblemSolutionDialog";

// The solutions of a problem in a table row. It never shows code: a plain
// button opens the dialog (which shows the code, like opening a note), and
// without any solution "Add solution" opens the editor.
const SolutionCell = ({ problem, solutions }) => {
  const [open, setOpen] = useState(false);
  const has = solutions.length > 0;

  return (
    <>
      {has ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Open solution for ${problem.title}`}
          className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Braces size={14} aria-hidden="true" />
          View solution
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Add solution for ${problem.title}`}
          className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add solution
        </button>
      )}
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

export default SolutionCell;
