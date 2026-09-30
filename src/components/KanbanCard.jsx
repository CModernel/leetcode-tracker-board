import { Calendar, ExternalLink } from "lucide-react";
import KanbanCardMenu from "./KanbanCardMenu";
import { difficultyColor } from "../lib/difficultyStyles";
import { problemLabel } from "../lib/lists";
import { formatShortDate } from "../lib/schedule";
import { urgencyButtonStyles, urgencyTextStyles } from "../lib/urgencyStyles";

// One problem on the board: title (opens the problem), difficulty, topics and,
// for problems waiting for a review, the review (R1..R5) with its due date in
// the same colors as the tracker.
const KanbanCard = ({ card }) => {
  const { problem, stage, nextDue, urgency } = card;

  return (
    <article className="bg-white dark:bg-gray-700 rounded-lg shadow p-3 transition-colors">
      <div className="flex items-start justify-between gap-1">
        <a
          href={problem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-start gap-1"
          title={`Open ${problem.title}`}
        >
          <span className="line-clamp-2">{problemLabel(problem)}</span>
          <ExternalLink size={12} className="flex-shrink-0 mt-1" />
        </a>
        <KanbanCardMenu card={card} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`text-xs font-semibold ${difficultyColor[problem.difficulty]}`}
        >
          {problem.difficulty}
        </span>
        {(problem.topics || []).map((topic) => (
          <span
            key={topic}
            className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded"
          >
            {topic}
          </span>
        ))}
      </div>
      {urgency && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs border ${urgencyButtonStyles[urgency]}`}
            title={`Review ${stage.slice(1)} - Due: ${formatShortDate(nextDue)}`}
          >
            {stage}
          </span>
          <span
            className={`text-xs flex items-center gap-1 ${urgencyTextStyles[urgency]}`}
          >
            <Calendar size={12} />
            {formatShortDate(nextDue)}
          </span>
        </div>
      )}
    </article>
  );
};

export default KanbanCard;
