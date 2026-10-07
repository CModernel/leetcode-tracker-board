import { Calendar, Check, Clock, ExternalLink } from "lucide-react";
import KanbanCardMenu from "./KanbanCardMenu";
import KanbanCardNote from "./KanbanCardNote";
import KanbanCardSolution from "./KanbanCardSolution";
import { KanbanCardTimerBar, KanbanCardTimerStart } from "./KanbanCardTimer";
import { useCardTimer } from "./useCardTimer";
import { useStartWork } from "./useStartWork";
import { useLingering } from "../hooks/useLingering";
import { useNotice } from "../context/NoticeContext";
import { solutionsOf } from "../lib/solutions";
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
const KanbanCard = ({ card, onComplete, onSolve }) => {
  const { problem, stage, nextDue, urgency } = card;
  const completeButton = onComplete ? completeButtonFor(card) : null;
  // An In Progress card has its own completing button, like a review has
  const solveButton = onSolve && stage === "in-progress";
  const timer = useCardTimer(problem, card.entry);
  // Tall buttons until a timer exists; then they shrink a little to make room
  const compact = Boolean(timer?.hasTime);
  const height = compact ? "h-7" : "h-8";
  // The bar folds away (instead of vanishing) when the timer is reset
  const barTimer = useLingering(compact ? timer : null, 220);
  const barLeaving = !compact && Boolean(barTimer);
  const iconSize = compact ? 14 : 16;
  const { startWork } = useStartWork();
  const showNotice = useNotice();
  // Opening the problem is starting to work on it: the timer starts by itself
  const open = () => {
    const paused = startWork(problem.id)?.paused;
    if (paused) {
      showNotice({ message: `Paused ${paused.title} at ${paused.time}`, undo: paused.resume });
    }
  };

  return (
    <article
      className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 transition-colors ${
        urgencyStripeStyles[
          urgency ?? (stage === "in-progress" ? "inProgress" : "none")
        ]
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-start gap-1"
            title={`Open ${problem.title}`}
            onClick={open}
          >
            <span className="line-clamp-2">{problemLabel(problem)}</span>
            <ExternalLink size={12} className="flex-shrink-0 mt-1" />
          </a>
          {/* Under the title, so it never drops to a line of its own among the chips */}
          {card.entry?.solved && card.entry?.solvedDate && (
            <p
              className="mt-0.5 whitespace-nowrap text-[11px] leading-tight text-gray-500 dark:text-gray-400"
              title="The first review is one day after this date"
            >
              Solved {formatShortDate(card.entry.solvedDate)}
            </p>
          )}
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
        </div>
        {/* One column on the right: the menu, then the note and the solution */}
        <div className="flex flex-shrink-0 flex-col items-center gap-0.5">
          <KanbanCardMenu card={card} onComplete={onComplete} />
          <KanbanCardNote problem={problem} note={card.entry?.note} />
          <KanbanCardSolution problem={problem} solutions={solutionsOf(card.entry)} />
        </div>
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
      {(completeButton || solveButton || barTimer) && (
        <div className="mt-2 flex flex-col gap-1">
          {/* The timer bar (with its control at the left) only when there is a time */}
          <KanbanCardTimerBar timer={barTimer} leaving={barLeaving} />
          <div className="flex gap-1">
            {/* Without a time the play button sits at the left of the same row */}
            {!timer?.hasTime && (completeButton || solveButton) && <KanbanCardTimerStart timer={timer} />}
            {completeButton && (
              <button
                onClick={() => onComplete(card)}
                aria-label={completeButton.label}
                title={completeButton.title}
                className={`flex ${height} min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-[height,filter] duration-200 hover:brightness-95 dark:hover:brightness-125 ${
                  reviewButtonStyles[urgency]
                }`}
              >
                {/* A clock for a review that can wait, a check for one that is due */}
                {completeButton.early ? (
                  <Clock size={iconSize} aria-hidden="true" />
                ) : (
                  <Check size={iconSize} aria-hidden="true" />
                )}
                {completeButton.text}
              </button>
            )}
            {solveButton && (
              <button
                onClick={() => onSolve(card)}
                aria-label="Mark as solved"
                title="Mark as solved"
                className={`flex ${height} min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50/70 text-xs font-semibold text-green-700 transition-[height,filter] duration-200 hover:brightness-95 dark:border-green-500/50 dark:bg-green-900/20 dark:text-green-300 dark:hover:brightness-125`}
              >
                <Check size={iconSize} aria-hidden="true" />
                Mark as solved
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default KanbanCard;
