import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Calendar,
  ExternalLink,
  Minus,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  localToday,
  getSchedule,
  formatShortDate,
  canCompleteReview,
  canRewindTo,
} from "../lib/schedule";
import { rewindConfirm } from "../lib/rewind";
import { filterProblems } from "../lib/filters";
import {
  getUrgency,
  urgencyButtonStyles,
  urgencyTextStyles,
} from "../lib/urgencyStyles";
import { SHOW_NOTES_KEY, parseShowNotes } from "../lib/preferences";
import NoteCell from "./NoteCell";
import { difficultyColor } from "../lib/difficultyStyles";
import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";

const ProblemTable = ({
  problems,
  progress,
}) => {
  const {
    filters,
    markSolved,
    unsolve,
    completeReview,
    setNote,
    markHelpViewed,
    rewindReviews,
  } = useProgress();
  const confirm = useConfirm();
  const today = localToday();

  // The Notes column can be hidden to keep the table narrow; the choice is
  // remembered in the browser.
  const [showNotes, setShowNotes] = useState(() => {
    try {
      return parseShowNotes(localStorage.getItem(SHOW_NOTES_KEY));
    } catch {
      return false;
    }
  });
  const toggleNotes = () => {
    const next = !showNotes;
    setShowNotes(next);
    try {
      localStorage.setItem(SHOW_NOTES_KEY, String(next));
    } catch (error) {
      console.error("Error saving the notes choice:", error);
    }
  };

  // A done review can be undone at any time. Going back more than one review
  // asks first, because it erases the later ones too.
  const toggleReview = async (problemId, prob, idx) => {
    if (!prob.reviews?.[idx]) return completeReview(problemId, idx);
    const question = rewindConfirm(prob, idx);
    if (question && !(await confirm(question))) return;
    rewindReviews(problemId, idx);
  };

  const filteredProblems = filterProblems(problems, progress, filters, today);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Problems
        </h2>
        <button
          onClick={toggleNotes}
          aria-pressed={showNotes}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            showNotes
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          {showNotes ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
          {showNotes ? "Hide notes" : "Show notes"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-40">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                Difficulty
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-40">
                Companies
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                Reviews & Due Dates
              </th>
              {showNotes && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[220px]">
                  Notes
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProblems.map((problem, index) => {
              const prob = progress[problem.id] || {};
              const nextReviews = getSchedule(prob);
              return (
                <tr
                  key={problem.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
                        title={`Open ${problem.name} on NeetCode`}
                      >
                        <span className="line-clamp-2">{problem.title}</span>
                        <ExternalLink size={14} className="flex-shrink-0" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex flex-wrap gap-1.5 max-w-[192px]">
                      {problem.listMeta?.section || problem.listMeta?.module ? (
                        <span
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded"
                          title="Category"
                        >
                          {problem.listMeta.section || problem.listMeta.module}
                        </span>
                      ) : null}
                      {(problem.topics || []).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded"
                          title="Topic"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${
                      difficultyColor[problem.difficulty]
                    }`}
                  >
                    {problem.difficulty}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap max-w-[192px]">
                      {problem.companies && problem.companies.length > 0 ? (
                        problem.companies.map((company, idx) => (
                          <div
                            key={idx}
                            className="relative group"
                            title={company.name}
                          >
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt={company.name}
                                className="h-6 w-6 object-contain cursor-pointer hover:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-gray-100 cursor-pointer hover:scale-110 transition-transform">
                                {company.name[0]}
                              </div>
                            )}
                            {/* Tooltip */}
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {company.name}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div
                          className="flex items-center gap-1 text-gray-400 dark:text-gray-500"
                          title="No company data available"
                        >
                          <Minus
                            size={16}
                            className="text-gray-300 dark:text-gray-600"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() =>
                        prob.solved
                          ? unsolve(problem.id)
                          : markSolved(problem.id)
                      }
                      className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      {prob.solved ? (
                        <CheckCircle2
                          className="text-green-600 dark:text-green-500"
                          size={20}
                        />
                      ) : (
                        <Circle size={20} />
                      )}
                      <span className="text-xs">
                        {prob.solved ? "Solved" : "Not Solved"}
                      </span>
                    </button>
                    {prob.solved && prob.solvedDate && (
                      <div
                        className="mt-0.5 pl-7 text-[10px] text-gray-500 dark:text-gray-400"
                        title={`Solved on ${formatShortDate(prob.solvedDate)}`}
                      >
                        {formatShortDate(prob.solvedDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {prob.solved ? (
                      <div className="flex flex-wrap gap-2">
                        {nextReviews.map((date, idx) => {
                          const isDone = Boolean(prob.reviews?.[idx]);
                          const canToggle = isDone
                            ? canRewindTo(prob, idx)
                            : canCompleteReview(prob, idx);
                          const urgency = getUrgency(
                            prob.reviews?.[idx],
                            date,
                            today
                          );

                          return (
                            <div
                              key={idx}
                              className="flex flex-col items-center"
                            >
                              <button
                                onClick={() => toggleReview(problem.id, prob, idx)}
                                disabled={!canToggle}
                                className={`px-2 py-1 rounded text-xs border min-w-[50px] transition-colors ${urgencyButtonStyles[urgency]} ${
                                  canToggle
                                    ? ""
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                                title={
                                  canToggle
                                    ? isDone
                                      ? `Go back to R${idx + 1}`
                                      : `Review ${idx + 1} - Due: ${formatShortDate(
                                          date
                                        )}`
                                    : `Complete R${idx} first`
                                }
                              >
                                {`R${idx + 1}`}
                              </button>
                              <div
                                className={`text-[10px] mt-1 flex items-center gap-0.5 ${urgencyTextStyles[urgency]}`}
                              >
                                <Calendar size={10} />
                                {formatShortDate(date)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Complete problem to see review schedule
                      </span>
                    )}
                  </td>
                  {showNotes && (
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 align-top">
                      <NoteCell
                        note={prob.note}
                        label={problem.title}
                        onSave={(text) => setNote(problem.id, text)}
                        onView={() => markHelpViewed(problem.id, "note")}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProblemTable;
