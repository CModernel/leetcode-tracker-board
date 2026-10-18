import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import ListSelect from "../components/ListSelect";
import Toast from "../components/Toast";
import ProblemList from "../components/insights/ProblemList";
import CategoryTable from "../components/insights/CategoryTable";
import ActivitySection from "../components/insights/ActivitySection";
import LoadSection from "../components/insights/LoadSection";
import { useStartWork } from "../components/useStartWork";
import { useProgress } from "../context/ProgressContext";
import { useTimerSettings } from "../context/TimerSettingsContext";
import { getProblems } from "../lib/lists";
import { localToday } from "../lib/schedule";
import {
  activeDaysThisWeek,
  activityDays,
  categoryOf,
  categoryStats,
  heatMap,
  rankCategories,
  streak,
  suggestNew,
  todayList,
  upcomingLoad,
} from "../lib/insights";

const Card = ({ title, children, className = "" }) => (
  <section className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors ${className}`}>
    <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
    {children}
  </section>
);

const lateText = (daysLate) =>
  daysLate === 0 ? "due today" : `${daysLate} ${daysLate === 1 ? "day" : "days"} late`;

// What the history of the selected list says: what to do today, what to try
// next, which categories need practice (help, step-backs, time), the activity
// and the reviews coming. Everything is computed from the saved progress.
const InsightsPage = () => {
  const { progress, selectedList } = useProgress();
  const { showTimer } = useTimerSettings();
  const { startWork } = useStartWork();
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  const today = localToday();
  const problems = getProblems(selectedList);
  const listProgress = progress[selectedList] || {};

  const ranked = rankCategories(categoryStats(problems, listProgress));
  const weak = new Set(ranked.filter((row) => row.weak).map((row) => row.category));
  // A category with nothing solved and no time yet is only named, not a row
  const started = (row) => row.attempts > 0 || row.timed > 0 || row.solved > 0;
  const startedRows = ranked.filter(started);
  const notStarted = ranked.filter((row) => !started(row)).map((row) => row.category);
  const anyHistory = startedRows.length > 0;
  const showTime = showTimer && ranked.some((row) => row.timed > 0);

  const due = todayList(problems, listProgress, today, weak);
  const allDue = todayList(problems, listProgress, today, weak, Infinity).length;
  const fresh = suggestNew(problems, listProgress, weak);
  const days = activityDays(listProgress);

  // Opening a problem starts working on it, as on the board and in the table
  const open = (problem) => {
    const paused = startWork(problem.id)?.paused;
    if (paused) {
      setNotice({ id: Date.now(), message: `Paused ${paused.title} at ${paused.time}`, undo: paused.resume });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-800 dark:text-white">
                Insights - {selectedList}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Where you need more practice, and what to do next
              </p>
            </div>
            <ListSelect />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="What to do today">
            <ProblemList
              items={due.map((item) => ({
                problem: item.problem,
                detail: `${item.stage} · ${lateText(item.daysLate)} · ${categoryOf(item.problem)}`,
                highlight: item.weak ? "Needs practice" : null,
              }))}
              onOpen={open}
              empty="No reviews due today."
            />
            {allDue > due.length && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Showing {due.length} of {allDue} ·{" "}
                <Link to="/board" className="text-blue-600 hover:underline dark:text-blue-400">
                  see all on the Board
                </Link>
              </p>
            )}
          </Card>
          <Card title="Try next">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {fresh.fromWeak
                ? "New problems from the categories that need practice, easiest first."
                : "The next new problems in the list. After a few reviews, the ones from your weak categories show here."}
            </p>
            <ProblemList
              items={fresh.problems.map((problem) => ({ problem, detail: categoryOf(problem) }))}
              onOpen={open}
              empty="Every problem in this list is started."
            />
          </Card>
        </div>

        <Card title="By category">
          {anyHistory ? (
            <CategoryTable rows={startedRows} showTime={showTime} notStarted={notStarted} />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing to analyse yet. Solve problems and complete reviews: each review you complete says how much
              help it needed, and this table shows which categories need more practice.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Activity">
            <ActivitySection
              streak={streak(days, today)}
              thisWeek={activeDaysThisWeek(days, today)}
              grid={heatMap(days, today)}
            />
          </Card>
          <Card title="Coming up">
            <LoadSection load={upcomingLoad(problems, listProgress, today)} />
          </Card>
        </div>
      </div>
      {notice && (
        <Toast
          key={notice.id}
          message={notice.message}
          onClose={closeNotice}
          actionLabel="Undo"
          onAction={notice.undo}
        />
      )}
    </div>
  );
};

export default InsightsPage;
