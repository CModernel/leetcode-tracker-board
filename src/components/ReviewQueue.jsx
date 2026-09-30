import { CheckCircle2 } from "lucide-react";
import { problemLabel } from "../lib/lists";
import { formatShortDate } from "../lib/schedule";
import { urgencyButtonStyles, urgencyTextStyles } from "../lib/urgencyStyles";

// The reviews to do today, the one waiting longest first. Completing one takes
// it out of the list; when it is empty, the day's reviews are done.
const ReviewQueue = ({ items, onComplete }) => (
  <section
    aria-label="Review today"
    className="mb-4 rounded-lg bg-white dark:bg-gray-800 shadow p-4 transition-colors"
  >
    <h2 className="font-semibold text-gray-800 dark:text-white mb-2">
      Review today
    </h2>
    {items.length === 0 ? (
      <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
        You are all caught up. Nothing is due today.
      </p>
    ) : (
      <ol className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item) => (
          <li
            key={item.problem.id}
            className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <a
                href={item.problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {problemLabel(item.problem)}
              </a>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded border ${urgencyButtonStyles[item.urgency]}`}
                >
                  {item.stage}
                </span>
                <span className={urgencyTextStyles[item.urgency]}>
                  {item.daysLate === 0
                    ? "Due today"
                    : `${item.daysLate} ${item.daysLate === 1 ? "day" : "days"} late (${formatShortDate(item.nextDue)})`}
                </span>
              </div>
            </div>
            <button
              onClick={() => onComplete(item)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              Complete {item.stage}
            </button>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default ReviewQueue;
