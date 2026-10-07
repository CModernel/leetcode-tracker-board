import { Link } from "react-router-dom";
import { Pause } from "lucide-react";
import { useProgress } from "../context/ProgressContext";
import { useNow } from "../hooks/useNow";
import { getProblems } from "../lib/lists";
import { activityOf, elapsedMs, findRunningTimer, formatDuration } from "../lib/timer";

// The timer that is running, on every page (in the navbar): the time, what is
// being timed ("Two Sum · R2" or "... · First solve"), a pause button and a link
// to the board where the card is. Nothing when no timer runs.
const RunningTimerPill = () => {
  const { progress, pauseTimer } = useProgress();
  const running = findRunningTimer(progress);
  const now = useNow(running !== null);
  if (!running) return null;

  const entry = progress[running.list][running.problemId];
  const title = getProblems(running.list).find((p) => p.id === running.problemId)?.title ?? "";
  const label = activityOf(entry)?.label ?? "";
  const time = formatDuration(elapsedMs(entry.timer, now));

  return (
    <div
      className="flex h-10 flex-shrink-0 items-center rounded border border-blue-300 bg-blue-50 text-xs font-semibold text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
    >
      <button
        onClick={() => pauseTimer(running.problemId, running.list)}
        aria-label={`Pause timer (${title}, ${label})`}
        title="Pause timer"
        className="flex h-full w-8 flex-shrink-0 items-center justify-center rounded-l hover:bg-blue-100 dark:hover:bg-blue-800/40"
      >
        <Pause size={14} aria-hidden="true" />
      </button>
      <Link
        to="/board"
        title={`Go to ${title} on the board`}
        className="flex h-full min-w-0 items-center gap-1.5 rounded-r pr-2.5 hover:bg-blue-100 dark:hover:bg-blue-800/40"
      >
        <span role="timer" aria-label="Running time" className="tabular-nums">
          {time}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium opacity-80 md:inline">
          · {title} · {label}
        </span>
      </Link>
    </div>
  );
};

export default RunningTimerPill;
