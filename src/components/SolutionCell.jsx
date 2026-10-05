import { useState } from "react";
import { Braces, Plus } from "lucide-react";
import ProblemSolutionDialog from "./ProblemSolutionDialog";

// The solutions of a problem in a table row. It never shows code: a plain
// button per solution ("Solution 1", "Solution 2", or its name; a single one
// is "View solution") opens the same dialog (which shows the code, like
// opening a note) on that solution; without any, "Add solution" opens the editor.
const SolutionCell = ({ problem, solutions }) => {
  // null = closed; otherwise the solution the dialog opens on
  const [open, setOpen] = useState(null);
  const has = solutions.length > 0;
  const buttonStyle =
    "flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors";

  return (
    <>
      {has ? (
        <div className="flex flex-wrap gap-1">
          {solutions.map((solution, index) => {
            const text =
              solutions.length === 1
                ? "View solution"
                : solution.name || `Solution ${index + 1}`;
            return (
              <button
                key={index}
                onClick={() => setOpen(index)}
                aria-label={
                  solutions.length === 1
                    ? `Open solution for ${problem.title}`
                    : `Open ${text} for ${problem.title}`
                }
                className={buttonStyle}
              >
                <Braces size={14} aria-hidden="true" />
                {text}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => setOpen(0)}
          aria-label={`Add solution for ${problem.title}`}
          className={buttonStyle}
        >
          <Plus size={14} aria-hidden="true" />
          Add solution
        </button>
      )}
      {open !== null && (
        <ProblemSolutionDialog
          problem={problem}
          solutions={solutions}
          initialIndex={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
};

export default SolutionCell;
