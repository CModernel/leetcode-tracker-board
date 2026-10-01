import { Calendar, Check, Clock, ExternalLink } from "lucide-react";
import KanbanCardMenu from "./KanbanCardMenu";
import KanbanCardNote from "./KanbanCardNote";
import { difficultyColor } from "../lib/difficultyStyles";
import { problemLabel } from "../lib/lists";
import { completeButtonFor } from "../lib/board";
import { formatShortDate } from "../lib/schedule";
import {
  reviewButtonStyles,
  urgencyButtonStyles,
  urgencyStripeStyles,
  urgencyTextStyles,
} from "../lib/urgencyStyles";

// One problem on the board: title (opens the problem), difficulty, topics and,
// for problems waiting for a review, one button that is the review and the
// action in one: "✓ R3 · 3d late" (red, overdue), "✓ R1 · today" (yellow) or,
// when it is not due yet, "🕒 R1 · Oct 2" as a dashed gray outline. `onComplete(card)`
// runs when it is pressed (no button when it is not given).
const KanbanCard = ({ card, onComplete }) => {
  const { problem, stage, nextDue, urgency } = card;
  const completeButton = onComplete ? completeButtonFor(card) : null;

  return (
    <article
      className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 transition-colors ${
        urgencyStripeStyles[urgency ?? "none"]
      }`}
    >
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
        <div className="flex flex-shrink-0 items-center">
          <KanbanCardNote problem={problem} note={card.entry?.note} />
          <KanbanCardMenu card={card} />
        </div>
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
        {card.entry?.solved && card.entry?.solvedDate && (
          <span
            className="ml-auto text-xs text-gray-500 dark:text-gray-400"
            title="The first review is one day after this date"
          >
            Solved {formatShortDate(card.entry.solvedDate)}
          </span>
        )}
      </div>
      {urgency && !completeButton && (
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
      {completeButton && (
        <button
          onClick={() => onComplete(card)}
          aria-label={completeButton.label}
          title={completeButton.title}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition hover:brightness-95 dark:hover:brightness-125 ${
            reviewButtonStyles[urgency]
          }`}
        >
          {/* A clock for a review that can wait, a check for one that is due */}
          {completeButton.early ? (
            <Clock size={16} aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          {completeButton.text}
        </button>
      )}
    </article>
  );
};

export default KanbanCard;
