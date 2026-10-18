import { Pause, Play, RotateCcw } from "lucide-react";
import { formatDuration } from "../lib/timer";

// Every bar of a card has the same small height, so cards stay compact.
// The compact bars (h-7) are used once a timer exists; before, the play button is
// as tall as the button it sits next to (h-8).
const BAR = "flex items-center rounded-lg border text-xs font-semibold transition";

// The timer bar by how it stands: blue while running, grey when paused, amber
// past the limit (and its tolerance), red once it timed out.
export const barStyles = (timer) => {
  if (timer.state === "timeout") {
    return "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300";
  }
  if (timer.state === "grace" || timer.state === "late") {
    return "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return timer.running
    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
    : "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-500 dark:bg-gray-800/50 dark:text-gray-200";
};

// The small play button at the left of the bar when no timer has been started.
// The timer also starts by itself (opening the problem, Start, dragging to In
// Progress).
export const KanbanCardTimerStart = ({ timer }) => {
  if (!timer) return null;
  return (
    <button
      onClick={timer.start}
      aria-label="Start timer"
      title={`Start timer (${timer.activity.label})`}
      className={`${BAR} h-8 w-8 flex-shrink-0 justify-center border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700`}
    >
      <Play size={16} aria-hidden="true" />
    </button>
  );
};

// The timer bar, above the button that completes: the control at the LEFT
// (play, pause or resume, always the same place) with the time and what is
// being timed, and a small reset at the right. Only shown when there is a time;
// when it is reset (`leaving`) it folds away instead of vanishing.
export const KanbanCardTimerBar = ({ timer, leaving = false }) => {
  if (!timer || !timer.hasTime) return null;
  const action = `${timer.running ? "Pause" : "Resume"} timer (${timer.activity.label})`;
  return (
    <div
      aria-hidden={leaving || undefined}
      className={`${leaving ? "timer-bar-out" : "timer-bar-in"} flex gap-1 overflow-hidden`}
    >
      <button
        onClick={timer.toggle}
        title={action}
        aria-label={action}
        className={`${BAR} h-7 min-w-0 flex-1 gap-1.5 px-2 hover:brightness-95 dark:hover:brightness-125 ${barStyles(timer)}`}
      >
        {timer.running ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
        <span role="timer" aria-label={`Time on ${timer.activity.label}`} className="tabular-nums">
          {formatDuration(timer.ms)}
        </span>
        <span aria-hidden="true" className="truncate font-medium opacity-80">
          · {timer.activity.label}
        </span>
      </button>
      <button
        onClick={timer.reset}
        aria-label="Reset timer"
        title="Reset timer (the time will not be recorded)"
        className={`${BAR} h-7 w-7 flex-shrink-0 justify-center border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700`}
      >
        <RotateCcw size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
