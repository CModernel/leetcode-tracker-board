import { ExternalLink } from "lucide-react";
import { difficultyColor } from "../../lib/difficultyStyles";
import { problemLabel } from "../../lib/lists";

// A short list of problems with a line of detail each. Opening a problem starts
// working on it, like everywhere else (`onOpen`).
const ProblemList = ({ items, onOpen, empty }) => {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {items.map(({ problem, detail, highlight }) => (
        <li key={problem.id} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${problem.title}`}
              onClick={() => onOpen(problem)}
              className="flex items-start gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span className="line-clamp-2">{problemLabel(problem)}</span>
              <ExternalLink size={12} className="mt-1 flex-shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span className={`font-semibold ${difficultyColor[problem.difficulty] ?? ""}`}>
                {problem.difficulty}
              </span>
              {" · "}
              {detail}
            </p>
          </div>
          {highlight && (
            <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {highlight}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

export default ProblemList;
